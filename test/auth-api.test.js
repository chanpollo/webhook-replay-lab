import test from 'node:test';import assert from 'node:assert/strict';import {createLab} from '../src/server.js';
const admin='a'.repeat(64),capture='b'.repeat(64),read='c'.repeat(64);
const entries=[{id:'capture',scope:'capture',token:capture},{id:'read',scope:'read',token:read}];
async function fixture(t,credentials=entries){let clock=Date.now();let sends=0;const server=createLab({token:admin,scopedCredentials:credentials,now:()=>clock,send:async()=>{sends++;return{status:200};}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));return {advance:()=>clock+=60001,sends:()=>sends,async api(token,method,path,body){const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,body:await response.json()};}};}
test('real scoped API denies mutations/readback before body parsing and cannot replay admin nonce',async t=>{
 const f=await fixture(t);const e=await f.api(capture,'POST','/api/events',{payload:{hello:'synthetic',secret:'hidden'}});assert.equal(e.status,201);assert.equal(e.body.payload.secret,'[REDACTED]');assert.equal(e.body.allowlist,undefined);assert.equal(e.body.events,undefined);
 assert.equal((await f.api(capture,'GET','/api/events')).status,403);assert.equal((await f.api(read,'GET','/api/events')).body.events.length,1);assert.equal((await f.api(read,'GET','/api/events/'+e.body.id+'/fixture')).status,200);
 for(const token of [capture,read])for(const path of ['/api/delete','/api/prepare','/api/replay','/api/fixtures/import','/api/collections/import','/api/redaction/preview'])assert.equal((await f.api(token,'POST',path,{id:e.body.id,nonce:'forged',confirm:'SEND TO STAGING'})).status,403,path);
 assert.equal((await f.api(read,'POST','/api/events',{payload:{x:1}})).status,403);assert.equal(f.sends(),0);assert.equal((await f.api(admin,'GET','/api/events')).body.events.length,1);
});
test('capture budget cannot exhaust independent admin/read request budgets',async t=>{
 const f=await fixture(t);for(let i=0;i<120;i++)assert.equal((await f.api(capture,'POST','/api/events',{payload:{i}})).status,201);
 assert.equal((await f.api(capture,'POST','/api/events',{payload:{i:121}})).status,429);assert.equal((await f.api(admin,'GET','/api/events')).status,200);assert.equal((await f.api(read,'GET','/api/events')).status,200);f.advance();assert.equal((await f.api(capture,'POST','/api/events',{payload:{next:true}})).status,201);
});
test('new server credential snapshot revokes prior scoped key without affecting independent reader',async t=>{
 const fresh='d'.repeat(64),f=await fixture(t,[{...entries[0],token:fresh},entries[1]]);assert.equal((await f.api(capture,'POST','/api/events',{payload:{x:1}})).status,401);assert.equal((await f.api(fresh,'POST','/api/events',{payload:{x:1}})).status,201);assert.equal((await f.api(read,'GET','/api/events')).status,200);
});
