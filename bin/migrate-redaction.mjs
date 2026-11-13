import {fileURLToPath} from 'node:url';
import {copySnapshot} from './rotate-storage-key.mjs';
import {readSecret} from '../src/secrets.js';
import {createRedactor,readRedactionPaths} from '../src/redaction.js';

export function migrateRedaction({source,destination,key,paths}) {
  const sanitize=createRedactor(paths);
  let removedAttempts=0;
  const result=copySnapshot({source,destination,oldKey:key,newKey:key,transform:state=>({
    version:1,
    events:state.events.map(event=>{
      removedAttempts+=event.attempts.length;
      return {id:event.id,createdAt:event.createdAt,label:'Migrated capture',payload:sanitize(event.payload),attempts:[]};
    }),
    receipts:state.receipts,
    ...(state.receiptHashes===undefined?{}:{receiptHashes:state.receiptHashes}),
    ...(state.receiptProviders===undefined?{}:{receiptProviders:state.receiptProviders})
  })});
  return {...result,removedAttempts,labelsReset:true};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.length!==4||!process.env.LAB_REDACTION_PATHS_FILE)throw Error();
    const result=migrateRedaction({source:process.argv[2],destination:process.argv[3],key:readSecret('LAB_STORAGE_KEY'),paths:readRedactionPaths(process.env.LAB_REDACTION_PATHS_FILE)});
    console.log(JSON.stringify(result));
  }catch {console.error('Offline redaction migration failed. Stop writers; check private key, rules, snapshot and an absent destination. Original preserved. Inspect destination before retry. Usage: node bin/migrate-redaction.mjs SOURCE DESTINATION; LAB_REDACTION_PATHS_FILE required.');process.exitCode=1;}
}
