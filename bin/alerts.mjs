import {fileURLToPath} from 'node:url';
import {readSecret} from '../src/secrets.js';
import {evaluateAlerts} from '../src/alerts.js';

export async function checkAlerts({base='http://127.0.0.1:4319',token,previous=null,fetchImpl=fetch}={}) {
 const url=new URL(base);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Loopback HTTP base required');
 if(typeof token!=='string'||!/^[\x21-\x7e]{32,256}$/.test(token))throw Error('Admin token required');
 try {
   const response=await fetchImpl(new URL('/api/diagnostics',url),{headers:{authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(5000)});
   if(!response.ok)return {result:evaluateAlerts({available:false}),diagnostics:null};
   // Diagnostics are bounded locally; reject an unexpected oversized response.
   const reader=response.body.getReader();const chunks=[];let size=0;
   try {for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16384)throw Error();chunks.push(value);}}finally{await reader.cancel();}
   const diagnostics=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   return {result:evaluateAlerts({diagnostics,previous}),diagnostics};
 }catch {return {result:evaluateAlerts({available:false}),diagnostics:null};}
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
 try {
   const args=process.argv.slice(2);if(args.length>1||(args.length&&args[0]!=='--watch'))throw Error();
   const token=readSecret('LAB_TOKEN'),base=process.env.LAB_ALERT_BASE||'http://127.0.0.1:4319';let previous=null;
   do {
     const {result,diagnostics}=await checkAlerts({base,token,previous});
     console.log(JSON.stringify(result));previous=diagnostics||previous;process.exitCode=result.ok?0:1;
     if(!args.length)break;
     await new Promise(resolve=>setTimeout(resolve,60000));
   }while(true);
 }catch {console.error('Alert configuration invalid. Use a private admin token source, loopback HTTP LAB_ALERT_BASE and optional --watch. No credentials or remote destinations are printed.');process.exitCode=2;}
}
