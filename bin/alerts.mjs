import {fileURLToPath} from 'node:url';
import {readSecret} from '../src/secrets.js';
import {evaluateAlerts} from '../src/alerts.js';
import {localJSON} from '../src/local-api.js';

export async function checkAlerts({base='http://127.0.0.1:4319',token,previous=null}={}) {
 const url=new URL(base);
 if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Loopback HTTP base required');
 if(typeof token!=='string'||!/^[\x21-\x7e]{32,256}$/.test(token))throw Error('Admin token required');
 try {
   const response=await localJSON({base:url,path:'/api/diagnostics',token});
   if(response.status!==200)return {result:evaluateAlerts({available:false}),diagnostics:null};
   const diagnostics=response.data;
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
