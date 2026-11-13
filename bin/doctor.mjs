#!/usr/bin/env node
// Read-only configuration diagnostics: no .env loading, network calls or secret output.
import {openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {targetURL} from '../src/core.js';
import {readStripeSecret,createStripeVerifier} from '../src/provider-signatures.js';
import {createRedactor} from '../src/redaction.js';
import {randomBytes} from 'node:crypto';
import {createCredentialPolicy,readScopedCredentials} from '../src/auth.js';
function boundedFile(path,max,privateOnly=false){let fd;try{fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const st=fstatSync(fd);if(!st.isFile()||st.size>max||(privateOnly&&(st.mode&0o077)!==0))throw Error();const buffer=Buffer.alloc(max+1);let size=0;while(size<buffer.length){const n=readSync(fd,buffer,size,buffer.length-size,null);if(n===0)break;size+=n;}if(size>max)throw Error();return new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,size));}finally{if(fd!==undefined)closeSync(fd);}}
export function diagnose(env=process.env,nodeVersion=process.versions.node) {
 const checks=[];const add=(id,status,action)=>checks.push({id,status,...(action?{action}:{})});
 add('node',Number(nodeVersion.split('.')[0])>=22?'pass':'fail',Number(nodeVersion.split('.')[0])>=22?undefined:'Install a supported Node.js version >=22.');
 function secret(name){if(!env[name+'_FILE'])return env[name]||'';try{const v=boundedFile(env[name+'_FILE'],4096,true).trim();add(name.toLowerCase()+'_file','pass');return v;}catch{add(name.toLowerCase()+'_file','fail','Use an owner-only regular secret file no larger than 4 KB; symlinks are not accepted by this diagnostic.');return '';}}
 const token=secret('LAB_TOKEN'),key=secret('LAB_STORAGE_KEY'),ingress=secret('LAB_INGRESS_KEY');
 let adminValid=false;try{createCredentialPolicy({adminToken:token});adminValid=true;}catch{}
 add('admin_token',adminValid?'pass':token?'fail':'warn',adminValid?undefined:token?'Use an independently generated random token of 32–256 printable non-space ASCII characters.':'No configured token: the server generates a session token. Set a private token for reproducible deployment.');
 if(env.LAB_SCOPED_TOKENS_FILE){try{const credentials=readScopedCredentials(env.LAB_SCOPED_TOKENS_FILE);createCredentialPolicy({adminToken:token||randomBytes(32).toString('hex'),credentials});add('scoped_credentials','pass');}catch{add('scoped_credentials','fail','Use a private regular JSON file up to 16 KB with at most 16 unique capture/read credentials; validate token format, IDs and separation from the admin token.');}}
 add('storage',env.LAB_DATA_PATH?'pass':'warn',env.LAB_DATA_PATH?undefined:'Memory-only mode loses records when stopped. Configure encrypted persistence if needed.');
 if(env.LAB_DATA_PATH)add('storage_key',/^[a-f0-9]{64}$/i.test(key)?'pass':'fail',/^[a-f0-9]{64}$/i.test(key)?undefined:'Supply a 64-character hexadecimal key paired with existing data; never replace an existing key without migration.');
 if(ingress)add('signed_ingress',env.LAB_DATA_PATH&&/^[a-f0-9]{64}$/i.test(ingress)?'warn':'fail','Signed ingress requires persistent storage, a separate 64-character hexadecimal key and an independently reviewed exposure plan.');
 else add('signed_ingress','pass');
 try{const stripeSecret=readStripeSecret(env);if(stripeSecret!==null){createStripeVerifier({secret:stripeSecret});add('stripe_ingress',env.LAB_DATA_PATH?'warn':'fail','Stripe test-mode ingress requires encrypted persistence and an independently reviewed exposure plan; no public route or provider account was verified.');}else add('stripe_ingress','pass');}catch{add('stripe_ingress','fail','Configure one valid Stripe signing-secret source only: an environment value or private owned non-linked regular file up to 4 KB.');}
 if(env.LAB_REDACTION_PATHS_FILE){try{createRedactor(JSON.parse(boundedFile(env.LAB_REDACTION_PATHS_FILE,16384)));add('redaction_paths','pass');}catch{add('redaction_paths','fail','Use a regular JSON file up to 16 KB containing at most 32 supported restricted JSONPath rules.');}}
 const allowlist=(env.STAGING_ALLOWLIST||'').split(',').filter(Boolean);try{for(const u of allowlist)targetURL(u,allowlist);add('replay_allowlist',allowlist.length?'pass':'warn',allowlist.length?undefined:'No staging target configured; replay is disabled.');}catch{add('replay_allowlist','fail','Use exact owned staging HTTPS hostname URLs on port 443 without credentials, query or fragment.');}
 const port=env.PORT===undefined?4319:Number(env.PORT);add('port',Number.isInteger(port)&&port>=1&&port<=65535?'pass':'fail',Number.isInteger(port)&&port>=1&&port<=65535?undefined:'Use an integer TCP port from 1 to 65535.');
 if(env.CONTAINER_MODE==='1')add('binding','warn','Container mode binds all interfaces inside its network namespace. Verify host publishing remains loopback-only; this command does not inspect Docker or firewall state.');else add('binding','pass');
 return {ok:!checks.some(x=>x.status==='fail'),checks,limits:['Does not load .env, contact destinations, inspect running services, decrypt data, verify entropy, or prove deployment security.','Pass means configuration shape only; review file ownership, secret uniqueness, network exposure and backup recovery separately.']};
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {if(process.argv.length!==2){process.stdout.write(JSON.stringify({ok:false,error:'Usage: node bin/doctor.mjs (reads current environment only)'})+'\n');process.exitCode=2;}else {const result=diagnose();process.stdout.write(JSON.stringify(result,null,2)+'\n');process.exitCode=result.ok?0:2;}}
