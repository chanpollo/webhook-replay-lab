import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,readFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../src/store.js';
import {createLab} from '../src/server.js';
import {migrateRedaction} from '../bin/migrate-redaction.mjs';
const key='ab'.repeat(32),paths=['$.customer.name','$.items[*].memo'];
function fixture(t){const dir=realpathSync(mkdtempSync(join(tmpdir(),'hook-redact-')));t.after(()=>rmSync(dir,{recursive:true,force:true}));const source=join(dir,'old.enc'),destination=join(dir,'new.enc');const state={version:1,events:[{id:'synthetic',createdAt:Date.now(),label:'private-label',payload:{customer:{name:'private-name'},items:[{memo:'private-memo'}],amount:100},attempts:[{outcome:'sending',url:'https://private.example',error:'private-error'}],extra:'private-extra'}],receipts:[['receipt',Date.now()]],receiptHashes:[['receipt','a'.repeat(64)]],receiptProviders:[['receipt','stripe']],extra:'private-root'};const store=createStore({path:source,key});store.save(state);store.close();return {source,destination,key,paths,state};}
test('redaction migration preserves source and dedup metadata, removes historical metadata, boots stricter policy',async t=>{
 const f=fixture(t),before=readFileSync(f.source);
 assert.deepEqual(migrateRedaction(f),{verified:true,events:1,receipts:1,removedAttempts:1,labelsReset:true});assert.deepEqual(readFileSync(f.source),before);
 const output=createStore({path:f.destination,key});const state=output.load();output.close();
 for(const value of ['private-label','private-name','private-memo','private.example','private-error','private-extra','private-root'])assert.equal(JSON.stringify(state).includes(value),false);
 assert.deepEqual(state.receiptHashes,f.state.receiptHashes);assert.deepEqual(state.receiptProviders,f.state.receiptProviders);assert.equal(state.events[0].createdAt,f.state.events[0].createdAt);assert.equal(state.events[0].payload.amount,100);assert.deepEqual(state.events[0].attempts,[]);
 const server=createLab({token:'synthetic-migration-admin-token-0000',redactionPaths:paths,store:createStore({path:f.destination,key})});await new Promise(resolve=>server.close(resolve));
});
test('invalid policy, wrong key, existing destination and active writers leave source unchanged',t=>{
 const f=fixture(t),before=readFileSync(f.source);assert.throws(()=>migrateRedaction({...f,paths:['$..bad']}),/JSONPath/);assert.equal(existsSync(f.destination),false);
 assert.throws(()=>migrateRedaction({...f,key:'cd'.repeat(32)}),/authentication/);
 const writer=createStore({path:f.source,key});assert.throws(()=>migrateRedaction(f),/locked/);writer.close();
 migrateRedaction(f);const dest=readFileSync(f.destination);assert.throws(()=>migrateRedaction(f),/not exist/);assert.deepEqual(readFileSync(f.destination),dest);assert.deepEqual(readFileSync(f.source),before);
});
