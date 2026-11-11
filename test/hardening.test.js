import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,copyFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createStore} from '../src/store.js';
import {createLab} from '../src/server.js';
const token='synthetic-hardening-test-token-000000',key='ab'.repeat(32);
async function start(store){const server=createLab({token,store});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;return {close:()=>new Promise(r=>server.close(r)),api:async(body)=>{const r=await fetch(base+'/api/events',{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};}};}
test('encrypted snapshot backup restores into an isolated directory and failed startup releases its own lock',async t=>{
  const original=mkdtempSync(join(tmpdir(),'lab-original-')),restored=mkdtempSync(join(tmpdir(),'lab-restored-'));
  t.after(()=>{rmSync(original,{recursive:true,force:true});rmSync(restored,{recursive:true,force:true});});
  const path=join(original,'inbox.enc'),backup=join(restored,'inbox.enc');
  const a=await start(createStore({path,key}));
  const captured=await a.api({label:'Restore test',payload:{type:'restore.test',token:'redact-me'}});
  assert.equal(captured.status,201);await a.close();
  assert.equal(existsSync(path+'.lock'),false);copyFileSync(path,backup);
  assert.throws(()=>createLab({token,store:createStore({path:backup,key:'cd'.repeat(32)})}),/authentication failed/);
  assert.equal(existsSync(backup+'.lock'),false);
  const b=await start(createStore({path:backup,key}));
  try {const result=await b.api();assert.equal(result.status,200);assert.equal(result.data.events[0].id,captured.data.id);assert.equal(result.data.events[0].payload.token,'[REDACTED]');} finally {await b.close();}
});
test('malformed restored states fail before listening and release the store',()=>{
  const good={id:'event-1',createdAt:Date.now(),label:'test',payload:{v:1},attempts:[]};
  for(const state of [false,0,"",
    {version:1,events:[{...good,attempts:null}],receipts:[]},
    {version:1,events:[good,good],receipts:[]},
    {version:1,events:[good],receipts:[['duplicate',1],['duplicate',2]]},
    {version:1,events:[{...good,attempts:[{outcome:'typo'}]}],receipts:[]},
    {version:1,events:[{...good,createdAt:'yesterday'}],receipts:[]}
  ]) {let closed=false;assert.throws(()=>createLab({token,store:{load:()=>state,save(){throw Error('must not write');},close(){closed=true;}}}),/Invalid persisted/);assert.equal(closed,true);}
});
test('redaction expansion cannot silently exceed the per-event storage bound',async t=>{
  const server=await start(null);t.after(server.close);
  const payload=Object.fromEntries(Array.from({length:3000},(_,i)=>['pin_'+i,0]));
  assert.ok(Buffer.byteLength(JSON.stringify({payload}))<65536);
  const result=await server.api({payload});assert.equal(result.status,400);assert.match(result.data.error,/Sanitized payload/);assert.equal((await server.api()).data.events.length,0);
});
