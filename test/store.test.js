import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, realpathSync, rmSync, readFileSync, writeFileSync, statSync, symlinkSync, unlinkSync, mkdirSync, chmodSync, truncateSync, readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore, MAX_STORE_BYTES} from '../src/store.js';
const key = '12'.repeat(32);
function location(t) { const directory = realpathSync(mkdtempSync(join(tmpdir(),'webhook-store-'))); t.after(()=>rmSync(directory,{recursive:true,force:true})); return {directory,path:join(directory,'events.enc'),key}; }
test('encrypted snapshots survive restart, overwrite atomically and never store plaintext',t=>{
 const options=location(t); let store=createStore(options); assert.equal(store.load(),null);
 const state={events:[{payload:{value:'synthetic-private-content'},attempts:[{outcome:'sending'}]}]};
 store.save(state); assert.deepEqual(store.load(),state);
 assert.equal(readFileSync(options.path).includes(Buffer.from('synthetic-private-content')),false);
 assert.equal(statSync(options.path).mode & 0o777,0o600); assert.equal(statSync(options.path+'.lock').mode & 0o777,0o600);
 store.close();store=createStore(options);assert.deepEqual(store.load(),state);store.save({events:[]});assert.deepEqual(store.load(),{events:[]});store.close();
 assert.deepEqual(readdirSync(options.directory),['events.enc']);assert.throws(()=>store.load(),/closed/);
});
test('wrong keys and ciphertext tampering fail closed',t=>{
 const options=location(t);let store=createStore(options);store.save({a:1});store.close();
 store=createStore({...options,key:'34'.repeat(32)});assert.throws(()=>store.load(),/authentication failed/);assert.throws(()=>store.save({overwrite:true}),/restart/);store.close();
 const bytes=readFileSync(options.path);bytes[bytes.length-1]^=1;writeFileSync(options.path,bytes);
 store=createStore(options);assert.throws(()=>store.load(),/authentication failed/);assert.throws(()=>store.save({overwrite:true}),/restart/);store.close();
});
test('exclusive lock blocks second writers and stale locks require operator removal',t=>{
 const options=location(t);const store=createStore(options);assert.throws(()=>createStore(options),/locked/);store.close();
 writeFileSync(options.path+'.lock','{"pid":999999999}',{mode:0o600});assert.throws(()=>createStore(options),/manually removing/);
});
test('symlink and nonregular destinations are rejected without modifying targets',t=>{
 const options=location(t);const target=join(options.directory,'target');writeFileSync(target,'do not change',{mode:0o600});
 symlinkSync(target,options.path);assert.throws(()=>createStore(options),/regular file/);assert.equal(readFileSync(target,'utf8'),'do not change');
 unlinkSync(options.path);mkdirSync(options.path);assert.throws(()=>createStore(options),/regular file/);
});
test('insecure existing file and writable shared directory are rejected',t=>{
 const options=location(t);writeFileSync(options.path,'invalid',{mode:0o644});assert.throws(()=>createStore(options),/private/);
 unlinkSync(options.path);chmodSync(options.directory,0o777);assert.throws(()=>createStore(options),/not writable by others/);chmodSync(options.directory,0o700);
});
test('bounded load rejects oversized and truncated files; oversized save preserves old state',t=>{
 const options=location(t);let store=createStore(options);store.save({a:1});assert.throws(()=>store.save({a:'x'.repeat(MAX_STORE_BYTES)}),/size limit/);assert.deepEqual(store.load(),{a:1});store.close();
 truncateSync(options.path,MAX_STORE_BYTES+1);store=createStore(options);assert.throws(()=>store.load(),/size/);store.close();
 truncateSync(options.path,2);store=createStore(options);assert.throws(()=>store.load(),/size/);store.close();
});
test('failed commit poisons further operations and leaves no partial temporary file',t=>{
 const options=location(t);const store=createStore(options);store.save({a:1});unlinkSync(options.path);mkdirSync(options.path);
 assert.throws(()=>store.save({a:2}),/commit failed/);assert.throws(()=>store.save({a:3}),/restart/);assert.throws(()=>store.load(),/restart/);
 assert.equal(readdirSync(options.directory).some(name=>name.endsWith('.tmp')),false);store.close();
});
test('invalid encryption settings fail before creating locks',t=>{
 const options=location(t);for(const key of ['', 'a'.repeat(63), 'z'.repeat(64)])assert.throws(()=>createStore({...options,key}),/32-byte hex/);
 assert.deepEqual(readdirSync(options.directory),[]);
});

test('symlink lock is not followed or removed',t=>{
 const options=location(t);const target=join(options.directory,'target');writeFileSync(target,'unchanged',{mode:0o600});
 symlinkSync(target,options.path+'.lock');assert.throws(()=>createStore(options),/locked/);assert.equal(readFileSync(target,'utf8'),'unchanged');
});
test('fresh snapshots use different IVs for identical content',t=>{
 const options=location(t);const store=createStore(options);store.save({a:1});const first=readFileSync(options.path);store.save({a:1});assert.notDeepEqual(first,readFileSync(options.path));store.close();
});
