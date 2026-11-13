import {lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from '../src/store.js';
import {readSecret} from '../src/secrets.js';
import {validateState} from '../src/server.js';

// Offline copy only: no listener, replay, source save or automatic lock removal.
export function rotateStorageKey({source,destination,oldKey,newKey}) {
  if(oldKey===newKey)throw Error('Rotation requires different keys');
  return copySnapshot({source,destination,oldKey,newKey});
}

export function copySnapshot({source,destination,oldKey,newKey,transform=state=>state}) {
  if(!source||!destination)throw Error('Distinct source and new destination required');
  const canonical=path=>join(realpathSync(dirname(resolve(path))),basename(path));
  source=canonical(source);destination=canonical(destination);
  if(source===destination)throw Error('In-place rotation is forbidden');
  let input,output;
  try {
    input=createStore({path:source,key:oldKey});
    const original=input.load();validateState(original);
    const state=transform(original);validateState(state);
    try {lstatSync(destination);throw Error('Destination must not exist');}catch(error){if(error.code!=='ENOENT')throw error;}
    // Destination locking prevents other cooperative writers during the copy.
    output=createStore({path:destination,key:newKey});
    if(output.load()!==null)throw Error('Destination must remain empty');
    output.save(state);
    if(JSON.stringify(output.load())!==JSON.stringify(state))throw Error('Destination verification failed');
    return {verified:true,events:state.events.length,receipts:state.receipts.length};
  } finally {try {output?.close();}finally{input?.close();}}
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {
    if(process.argv.length!==4)throw Error('Usage: node bin/rotate-storage-key.mjs SOURCE DESTINATION');
    const oldKey=readSecret('LAB_STORAGE_KEY'),newKey=readSecret('LAB_NEW_STORAGE_KEY');
    console.log(JSON.stringify(rotateStorageKey({source:process.argv[2],destination:process.argv[3],oldKey,newKey})));
  }catch {console.error('Offline key rotation failed. Stop all writers; check private files, keys, snapshot validity and an absent destination. Originals are never overwritten. Inspect any destination before retry.');process.exitCode=1;}
}
