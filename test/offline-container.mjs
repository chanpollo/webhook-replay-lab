import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const image=process.env.LAB_TEST_IMAGE||'webhook-replay-lab:test',id='hook-offline-'+randomUUID().slice(0,8),volume=id+'-data';
const token='synthetic-offline-admin-token-000000',oldKey='ab'.repeat(32),newKey='cd'.repeat(32);
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:90000,stdio:['ignore','pipe','pipe']});
const hardening=['--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','256m','--pids-limit','64','-v',volume+':/data'];
const offline=(key,args)=>docker('run','--rm',...hardening,'-e','LAB_STORAGE_KEY='+key,'-e','LAB_NEW_STORAGE_KEY='+newKey,'-e','LAB_REDACTION_PATHS_FILE=/data/rules.json',image,...args);
let active=false;
function stop(){if(active){docker('stop','-t','15',id);docker('rm',id);active=false;}}
function start(path,key,rules=false){docker('run','-d','--name',id,...hardening,'-e','LAB_TOKEN='+token,'-e','LAB_STORAGE_KEY='+key,'-e','LAB_DATA_PATH='+path,...(rules?['-e','LAB_REDACTION_PATHS_FILE=/data/rules.json']:[]),image);active=true;docker('exec',id,'node','--input-type=module','-e',`for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4319/healthz')).ok)process.exit(0);}catch{}await new Promise(r=>setTimeout(r,100));}process.exit(1);`);}
function inside(js){return docker('exec',id,'node','--input-type=module','-e',js);}
const auth=`const headers={authorization:'Bearer '+process.env.LAB_TOKEN,'content-type':'application/json'};`;
try{
 docker('volume','create',volume);start('/data/inbox.enc',oldKey);
 inside(`import fs from 'node:fs';fs.writeFileSync('/data/rules.json',JSON.stringify(['$.customer.name']),{mode:0o600});${auth}const r=await fetch('http://127.0.0.1:4319/api/events',{method:'POST',headers,body:JSON.stringify({label:'Synthetic old label',payload:{customer:{name:'synthetic-private'},secret:'mask-me'}})});if(r.status!==201)throw Error('capture');`);stop();
 const hash=()=>offline(oldKey,['node','--input-type=module','-e',`import fs from 'node:fs';import{createHash}from'node:crypto';console.log(createHash('sha256').update(fs.readFileSync('/data/inbox.enc')).digest('hex'));`]).trim(),original=hash();
 assert.equal(JSON.parse(offline(oldKey,['node','bin/migrate-redaction.mjs','/data/inbox.enc','/data/redacted.enc'])).verified,true);
 assert.equal(JSON.parse(offline(oldKey,['node','bin/rotate-storage-key.mjs','/data/redacted.enc','/data/rotated.enc'])).verified,true);assert.equal(hash(),original);
 start('/data/rotated.enc',newKey,true);
 inside(`${auth}const r=await fetch('http://127.0.0.1:4319/api/events',{headers});const b=await r.json(),e=b.events[0];if(r.status!==200||!b.persistent||b.events.length!==1||e.payload.customer.name!=='[REDACTED]'||e.payload.secret!=='[REDACTED]'||e.label!=='Migrated capture'||e.attempts.length)throw Error('migrated state');`);
 assert.equal(JSON.parse(docker('exec',id,'node','bin/alerts.mjs')).ok,true);stop();
 start('/data/inbox.enc',oldKey);inside(`${auth}const r=await fetch('http://127.0.0.1:4319/api/events',{headers});const b=await r.json();if(b.events[0].payload.customer.name!=='synthetic-private')throw Error('rollback');`);stop();
 console.log(JSON.stringify({ok:true,network:'none',hostPorts:false,checks:['stopped-writer redaction copy','different-key copy','private stricter-policy boot','local alert probe','original-path/key rollback','original ciphertext preserved during offline copies']}));
}finally{stop();docker('volume','rm',volume);}
