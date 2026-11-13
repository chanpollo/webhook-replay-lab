#!/usr/bin/env node
import {readFileSync,statSync} from 'node:fs';
import {validateFixture,validateCollection} from '../src/fixture.js';
import {localJSON} from '../src/local-api.js';
import {readSecret} from '../src/secrets.js';

const [command,file,...args]=process.argv.slice(2);
const output=value=>process.stdout.write(JSON.stringify(value)+'\n');
let replayStarted=false;
try {
 if(!['verify','replay'].includes(command)||!file)throw Error('Usage: node bin/fixtures.mjs verify FILE | replay FILE --entry NAME --server http://127.0.0.1:PORT --target HTTPS_URL --confirm "SEND TO STAGING"');
 if(statSync(file).size>262144)throw Error('Fixture file exceeds 256 KB');
 const input=JSON.parse(readFileSync(file,'utf8'));
 const checked=input.kind==='webhook-fixture-collection'?validateCollection(input):validateFixture(input);
 const fixtures=checked.collection?.fixtures||[{name:'fixture',fixture:{version:1,payload:checked.payload,sha256:checked.sha256}}];
 if(command==='verify') {
   if(args.length)throw Error('verify takes only a file');
   output({ok:!checked.redacted,count:fixtures.length,sha256:checked.sha256,redacted:checked.redacted,...(checked.redacted?{error:'Additional redaction required; review and export through the UI'}:{})});
   if(checked.redacted)process.exitCode=1;
 } else {
   const options={};
   for(let i=0;i<args.length;i+=2){if(!['--entry','--server','--target','--confirm'].includes(args[i])||args[i+1]===undefined||Object.hasOwn(options,args[i]))throw Error('Invalid or duplicate option');options[args[i]]=args[i+1];}
   if(options['--confirm']!=='SEND TO STAGING')throw Error('Explicit --confirm "SEND TO STAGING" required');
   const selected=fixtures.find(entry=>entry.name===(options['--entry']||'fixture'));if(!selected)throw Error('Select one fixture with --entry; collections are never replayed as a batch');
   if(checked.redacted)throw Error('Fixture needs redaction: use the UI to review and export sanitized fixtures first');
   const base=new URL(options['--server']||'');
   if(base.protocol!=='http:'||base.hostname!=='127.0.0.1'||!base.port||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Server must be an explicit http://127.0.0.1:PORT');
   if(!options['--target']?.startsWith('https://'))throw Error('Explicit staging HTTPS target required');
   const token=readSecret('LAB_TOKEN');
   if(!token||token.length<32)throw Error('LAB_TOKEN or LAB_TOKEN_FILE required');
   async function api(path,body){const response=await localJSON({base,path:'/api/'+path,token,body,maxBytes:32*1024*1024,timeoutMs:10000});if(response.status<200||response.status>=300)throw Error('Local API rejected '+path+' with HTTP '+response.status);return response.data;}
   const state=await api('events');if(!state.allowlist.includes(options['--target']))throw Error('Target is not in the local server staging allowlist');
   const event=await api('fixtures/import',{fixture:selected.fixture,confirmHash:selected.fixture.sha256});
   const approval=await api('prepare',{id:event.id,url:options['--target']});
   replayStarted=true;
   const result=await api('replay',{nonce:approval.nonce,confirm:'SEND TO STAGING'});
   output({ok:result.outcome==='response_received'&&result.status>=200&&result.status<300,eventId:event.id,attemptId:result.id,outcome:result.outcome,status:result.status??null,durationMs:result.durationMs??null});
   if(result.outcome!=='response_received'||result.status<200||result.status>=300)process.exitCode=2;
 }
} catch(error) {
 output({ok:false,outcome:replayStarted?'unknown_delivery':'not_sent',error:replayStarted?'Replay response unavailable; inspect server and receiver history before retrying':error.message});process.exitCode=replayStarted?2:1;
}
