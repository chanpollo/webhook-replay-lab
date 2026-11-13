import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtempSync,writeFileSync,rmSync,chmodSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {validateCollection} from '../src/fixture.js';import {digest} from '../src/core.js';import {createLab} from '../src/server.js';
const token='synthetic-collections-token-000000000';
const pack=payload=>({version:1,payload,sha256:digest(payload)});
const collection={kind:'webhook-fixture-collection',version:1,name:'Synthetic orders',fixtures:[{name:'first',fixture:pack({id:1})},{name:'second',fixture:pack({id:2})}]};
function cli(args,env={}) {return new Promise((resolve,reject)=>{const cleanEnv={...process.env};delete cleanEnv.LAB_TOKEN;delete cleanEnv.LAB_TOKEN_FILE;const p=spawn(process.execPath,['bin/fixtures.mjs',...args],{env:{...cleanEnv,...env}});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',code=>resolve({code,output:JSON.parse(stdout),stderr}));});}
async function lab(t,options={}) {const server=createLab({token,...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;
 const request=async(path,body)=>{const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};return {base,request};}
test('collections have deterministic hashes, strict names/count/shape and validate every fixture',()=>{
 const clean=validateCollection(collection);assert.deepEqual(clean.collection,collection);assert.equal(clean.sha256,digest(collection));
 for(const bad of [{...collection,version:2},{...collection,fixtures:[]},{...collection,fixtures:Array(21).fill(collection.fixtures[0])},{...collection,fixtures:[collection.fixtures[0],collection.fixtures[0]]},{...collection,name:'bad@email.test'},{...collection,extra:true},{...collection,fixtures:[{name:'bad',fixture:{...pack({id:1}),sha256:'0'.repeat(64)}}]}])assert.throws(()=>validateCollection(bad));
});
test('collection preview does not store; invalid entries and insufficient capacity never partially import',async t=>{
 const f=await lab(t);const preview=await f.request('collections/preview',{collection});assert.equal(preview.status,200);assert.equal((await f.request('events')).data.events.length,0);
 const invalid=structuredClone(collection);invalid.fixtures[1].fixture.sha256='0'.repeat(64);
 assert.equal((await f.request('collections/import',{collection:invalid,confirmHash:preview.data.sha256})).status,400);assert.equal((await f.request('events')).data.events.length,0);
 const saved=await f.request('collections/import',{collection,confirmHash:preview.data.sha256});assert.equal(saved.status,201);assert.equal(saved.data.events.length,2);assert.ok(saved.data.events.every(e=>e.attempts.length===0));
 const exported=await f.request('collections/export',{ids:saved.data.events.map(e=>e.id)});assert.equal(exported.status,200);assert.equal(validateCollection(exported.data).collection.fixtures.length,2);assert.equal((await f.request('collections/export',{ids:['missing']})).status,400);
 const initial={version:1,receipts:[],events:Array.from({length:199},(_,i)=>({id:'e'+i,createdAt:Date.now(),label:'Synthetic',payload:{i},attempts:[]}))};
 const full=await lab(t,{store:{load:()=>initial,save:()=>{},close:()=>{}}});assert.equal((await full.request('collections/import',{collection,confirmHash:preview.data.sha256})).status,409);assert.equal((await full.request('events')).data.events.length,199);
});
test('CI verification is offline and replay requires explicit entry, target, confirmation and token',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'lab-cli-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'fixture.json');writeFileSync(file,JSON.stringify(collection));
 const unsafeFile=join(dir,'unsafe.json');writeFileSync(unsafeFile,JSON.stringify(pack({password:'synthetic-do-not-share'})));const unsafe=await cli(['verify',unsafeFile]);assert.equal(unsafe.code,1);assert.equal(unsafe.output.redacted,true);assert.ok(!JSON.stringify(unsafe).includes('synthetic-do-not-share'));
 const verified=await cli(['verify',file]);assert.equal(verified.code,0);assert.equal(verified.output.count,2);
 const largeFile=join(dir,'large.json');const large={...collection,fixtures:Array.from({length:4},(_,i)=>({name:'item'+i,fixture:pack({x:'x'.repeat(65000)})}))};writeFileSync(largeFile,JSON.stringify(large));assert.equal((await cli(['verify',largeFile])).code,0);
 let sends=0;const target='https://synthetic.example.test/hook';const f=await lab(t,{allowlist:[target],resolve:async()=>({}),send:async()=>{sends++;return {status:202,durationMs:2};}});
 const common=['replay',file,'--entry','first','--server',f.base,'--target',target];
 assert.equal((await cli(common,{LAB_TOKEN:token})).code,1);assert.equal(sends,0);
 assert.equal((await cli([...common,'--confirm','SEND TO STAGING'])).code,1);assert.equal(sends,0);
 const done=await cli([...common,'--confirm','SEND TO STAGING'],{LAB_TOKEN:token});assert.equal(done.code,0);assert.equal(done.output.status,202);assert.equal(sends,1);assert.ok(!JSON.stringify(done).includes(token));
});
test('CLI unknown delivery exits nonzero without retry',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'lab-cli-unknown-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'fixture.json');writeFileSync(file,JSON.stringify(pack({synthetic:true})));
 let sends=0;const target='https://synthetic.example.test/hook';const f=await lab(t,{allowlist:[target],resolve:async()=>({}),send:async()=>{sends++;throw Error('synthetic timeout');}});
 const result=await cli(['replay',file,'--server',f.base,'--target',target,'--confirm','SEND TO STAGING'],{LAB_TOKEN:token});assert.equal(result.code,2);assert.equal(result.output.outcome,'unknown_delivery');assert.equal(sends,1);
});

test('fixture CLI uses a private exclusive secret file without leaking paths or tokens',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'hook-cli-secret-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const file=join(dir,'fixture.json'),secret=join(dir,'token');writeFileSync(file,JSON.stringify(pack({synthetic:true})));writeFileSync(secret,token,{mode:0o600});let sends=0;const target='https://synthetic.example.test/hook';const f=await lab(t,{allowlist:[target],resolve:async()=>({}),send:async()=>{sends++;return {status:204};}});const args=['replay',file,'--server',f.base,'--target',target,'--confirm','SEND TO STAGING'];
 assert.equal((await cli(args,{LAB_TOKEN_FILE:secret})).code,0);assert.equal(sends,1);
 const ambiguous=await cli(args,{LAB_TOKEN_FILE:secret,LAB_TOKEN:token});assert.equal(ambiguous.code,1);assert.equal(ambiguous.output.outcome,'not_sent');
 chmodSync(secret,0o644);const publicFile=await cli(args,{LAB_TOKEN_FILE:secret});assert.equal(publicFile.code,1);assert.equal(sends,1);for(const result of [ambiguous,publicFile])for(const value of [token,secret])assert.equal(JSON.stringify(result).includes(value),false);
});
