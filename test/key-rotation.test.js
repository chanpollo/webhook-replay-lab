import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,readFileSync,writeFileSync,existsSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createStore} from '../src/store.js';
import {createLab} from '../src/server.js';
import {rotateStorageKey} from '../bin/rotate-storage-key.mjs';
const oldKey='ab'.repeat(32),newKey='cd'.repeat(32);
function fixture(t){const dir=realpathSync(mkdtempSync(join(tmpdir(),'hook-key-')));t.after(()=>rmSync(dir,{recursive:true,force:true}));const source=join(dir,'old.enc'),destination=join(dir,'new.enc');const state={version:1,events:[{id:'synthetic',createdAt:Date.now(),label:'Synthetic',payload:{value:1},attempts:[{outcome:'sending'}]}],receipts:[['receipt',Date.now()]],receiptHashes:[['receipt','a'.repeat(64)]]};const store=createStore({path:source,key:oldKey});store.save(state);store.close();return {source,destination,oldKey,newKey,state};}
test('offline rotation preserves original bytes, receipts and uncertain attempts; new key boots',async t=>{
 const f=fixture(t),before=readFileSync(f.source);assert.deepEqual(rotateStorageKey(f),{verified:true,events:1,receipts:1});assert.deepEqual(readFileSync(f.source),before);
 const output=createStore({path:f.destination,key:newKey});assert.deepEqual(output.load(),f.state);output.close();
 const wrong=createStore({path:f.destination,key:oldKey});assert.throws(()=>wrong.load(),/authentication/);wrong.close();
 const server=createLab({token:'synthetic-rotation-token-000000000000',store:createStore({path:f.destination,key:newKey})});await new Promise(resolve=>server.close(resolve));
 const recovered=createStore({path:f.destination,key:newKey});assert.equal(recovered.load().events[0].attempts[0].outcome,'unknown_delivery');recovered.close();
});
test('rotation refuses live/stale locks, wrong key, in-place paths and existing/symlink destinations',t=>{
 const f=fixture(t),before=readFileSync(f.source);const active=createStore({path:f.source,key:oldKey});assert.throws(()=>rotateStorageKey(f),/locked/);active.close();
 assert.throws(()=>rotateStorageKey({...f,oldKey:'ef'.repeat(32)}),/authentication/);assert.equal(existsSync(f.destination),false);
 assert.throws(()=>rotateStorageKey({...f,destination:f.source}),/In-place/);
 assert.throws(()=>rotateStorageKey({...f,newKey:oldKey}),/different keys/);
 writeFileSync(f.source+'.lock','stale',{mode:0o600});assert.throws(()=>rotateStorageKey(f),/locked/);rmSync(f.source+'.lock');
 writeFileSync(f.destination,'preserve',{mode:0o600});assert.throws(()=>rotateStorageKey(f),/not exist/);assert.equal(readFileSync(f.destination,'utf8'),'preserve');rmSync(f.destination);
 symlinkSync(f.source,f.destination);assert.throws(()=>rotateStorageKey(f),/not exist/);assert.deepEqual(readFileSync(f.source),before);assert.equal(existsSync(f.source+'.lock'),false);
});
test('invalid snapshot and CLI failure do not disclose data or secrets',t=>{
 const f=fixture(t);const s=createStore({path:f.source,key:oldKey});s.save({version:1,events:[],receipts:[['bad',-1]]});s.close();assert.throws(()=>rotateStorageKey(f),/receipt/);assert.equal(existsSync(f.destination),false);
 const result=spawnSync(process.execPath,['bin/rotate-storage-key.mjs',f.source,f.destination],{encoding:'utf8',env:{...process.env,LAB_STORAGE_KEY:oldKey,LAB_NEW_STORAGE_KEY:newKey}});assert.equal(result.status,1);for(const secret of [oldKey,newKey,f.source,f.destination])assert.equal((result.stdout+result.stderr).includes(secret),false);
});
