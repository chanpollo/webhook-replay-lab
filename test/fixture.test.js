import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFixture} from '../src/fixture.js';
import {digest,redact} from '../src/core.js';
import {createLab} from '../src/server.js';
const token='synthetic-fixture-test-token-00000000';
const pack=payload=>({version:1,payload,sha256:digest(payload)});

test('fixture import rejects versions, hashes, scalar payloads and executable metadata',()=>{
 for(const value of [null,[],{...pack({x:1}),version:2},{...pack({x:1}),sha256:'0'.repeat(64)},pack('text'),{...pack({x:1}),url:'https://example.test'}])assert.throws(()=>validateFixture(value));
 let deep={};for(let i=0;i<35;i++)deep={x:deep};assert.throws(()=>validateFixture(pack(deep)),/nesting/);
 assert.throws(()=>validateFixture(pack({x:'x'.repeat(65536)})),/64 KB/);
});
test('fixture validation sanitizes again and preserves own prototype-named keys',()=>{
 const value=validateFixture(pack(JSON.parse('{"__proto__":{"safe":true},"secret":"never-store","memo":"demo@example.test"}')));
 assert.equal(value.payload.secret,'[REDACTED]');assert.equal(value.payload.memo,'[EMAIL]');assert.equal(value.redacted,true);
 assert.equal(Object.hasOwn(value.payload,'__proto__'),true);assert.equal(value.sha256,digest(value.payload));
 assert.equal(validateFixture(pack([1,{safe:true}])).redacted,false);
});
test('preview is read-only; confirmed import round-trips and never sends',async t=>{
 let sends=0;const server=createLab({token,send:async()=>{sends++;throw Error('must not send');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 async function request(path,body,auth=token){const response=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};}
 const fixture=pack({id:'demo',password:'synthetic-secret'});
 assert.equal((await request('fixtures/preview',{fixture},'bad')).status,401);
 const preview=await request('fixtures/preview',{fixture});assert.equal(preview.status,200);assert.equal(preview.data.payload.password,'[REDACTED]');
 assert.equal((await request('events')).data.events.length,0);
 assert.equal((await request('fixtures/import',{fixture})).status,400);
 assert.equal((await request('fixtures/import',{fixture,confirmHash:fixture.sha256})).status,400);
 const imported=await request('fixtures/import',{fixture,confirmHash:preview.data.sha256});assert.equal(imported.status,201);assert.deepEqual(imported.data.attempts,[]);
 const exported=await request('events/'+imported.data.id+'/fixture');assert.deepEqual(exported.data,pack(preview.data.payload));
 assert.equal((await request('events')).data.events.length,1);assert.equal(sends,0);
 const largeFixture=pack({x:'x'.repeat(65400)});
 const largePreview=await request('fixtures/preview',{fixture:largeFixture});assert.equal(largePreview.status,200);
 assert.equal((await request('fixtures/import',{fixture:largeFixture,confirmHash:largePreview.data.sha256})).status,201);
 assert.equal((await request('fixtures/preview',{fixture:pack({x:'x'.repeat(67000)})})).status,413);

});

test('redaction handles long strings and adversarial at-sign sequences without quadratic search',()=>{
 const plain='a'.repeat(65500);assert.equal(redact(plain),plain);
 const near=plain+'@x';assert.equal(redact(near),near);
 const dotted='a@'+'.'.repeat(65000)+'x';assert.equal(redact(dotted),dotted);
 const uppercase='A'.repeat(65000);assert.equal(redact({[uppercase]:1})[uppercase],1);
 const repeated='a@'.repeat(16000);assert.equal(redact(repeated),repeated);
 assert.equal(redact('Contact first.last+tag@example.test.'),'Contact [EMAIL]');
 assert.equal(redact('a@example.test@tail'),'[EMAIL]');
});
