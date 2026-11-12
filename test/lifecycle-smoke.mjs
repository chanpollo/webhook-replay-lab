import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const root=process.cwd(),tmp=mkdtempSync(join(tmpdir(),'hook-lifecycle-')),id=`hook-lifecycle-${process.pid}`;
const old=id+':old',candidate='webhook-replay-lab:release-candidate',vol=id+'-data',restore=id+'-restore',name=id+'-app';
const docker=(...args)=>execFileSync('docker',args,{encoding:'utf8',timeout:180000,stdio:['ignore','pipe','pipe']});
const token='synthetic-lifecycle-token-0000000000',key='cd'.repeat(32);
let active=false;
function stop(){if(active){docker('stop','-t','15',name);docker('rm',name);active=false;}}
function start(image,volume){docker('run','-d','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','256m','--pids-limit','64','-v',volume+':/data','-e','CONTAINER_MODE=1','-e','LAB_TOKEN='+token,'-e','LAB_STORAGE_KEY='+key,'-e','LAB_DATA_PATH=/data/inbox.enc',image);active=true;docker('exec',name,'node','--input-type=module','-e',`for(let i=0;i<50;i++){try{const r=await fetch('http://127.0.0.1:4319/healthz');if(r.ok)process.exit(0);}catch{}await new Promise(r=>setTimeout(r,100));}process.exit(1)`);}
function api(code){return docker('exec',name,'node','--input-type=module','-e',`const headers={authorization:'Bearer '+process.env.LAB_TOKEN,'content-type':'application/json'};const base='http://127.0.0.1:4319';${code}`);}
function verify(count){api(`const r=await fetch(base+'/api/events',{headers});const b=await r.json();if(r.status!==200||b.events.length!==${count}||b.events.some(e=>e.payload.password!=='[REDACTED]'))throw Error('state mismatch');`);}
try{
 // Historical application source on the current patched runtime, not a claim about historical image CVEs.
 const archive=execFileSync('git',['archive','v0.2.1'],{cwd:root});execFileSync('tar',['-xf','-','-C',tmp],{input:archive});
 let df=readFileSync(join(root,'Dockerfile'),'utf8').replace('COPY --chown=node:node bin ./bin\n','');writeFileSync(join(tmp,'Dockerfile'),df);
 docker('build','-t',old,tmp);docker('volume','create',vol);docker('volume','create',restore);
 start(old,vol);api(`const r=await fetch(base+'/api/events',{method:'POST',headers,body:JSON.stringify({label:'Before upgrade',payload:{synthetic:true,password:'secret'}})});if(r.status!==201)throw Error('capture');`);verify(1);stop();
 // Save a stopped-writer encrypted backup. No mount/network access to real services.
 const backup=docker('run','--rm','--network','none','--read-only','-v',vol+':/data:ro',candidate,'node','--input-type=module','-e',`import{readFileSync}from'node:fs';console.log(readFileSync('/data/inbox.enc').toString('base64'));`).trim();
 start(candidate,vol);verify(1);api(`const r=await fetch(base+'/api/events',{method:'POST',headers,body:JSON.stringify({label:'After upgrade',payload:{synthetic:true,password:'secret'}})});if(r.status!==201)throw Error('capture');`);verify(2);stop();
 start(old,vol);verify(2);stop();start(candidate,vol);verify(2);stop();
 docker('run','--rm','--network','none','--read-only','-v',restore+':/data',candidate,'node','--input-type=module','-e',`import{writeFileSync}from'node:fs';writeFileSync('/data/inbox.enc',Buffer.from(process.argv[1],'base64'),{mode:0o600,flag:'wx'});`,backup);
 start(candidate,restore);verify(1);stop();
 console.log(JSON.stringify({ok:true,oldSource:'v0.2.1',runtime:'current patched Dockerfile',checks:['fresh install','stopped backup','upgrade with retained state','rollback reads new state','re-upgrade','separate-volume recovery'],externalNetwork:false,hostPorts:false}));
}finally{stop();for(const v of [vol,restore]){try{docker('volume','rm',v);}catch{}}try{docker('image','rm',old);}catch{}rmSync(tmp,{recursive:true,force:true});}
