import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';import {createHmac} from 'node:crypto';import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createLab} from '../src/server.js';import {createStore} from '../src/store.js';
const token='a'.repeat(64),secret='whsec_synthetic_only_not_an_account_secret',genericKey='ab'.repeat(32),clock=1800000000000;
const event=(id='evt_synthetic')=>({object:'event',id,livemode:false,data:{secret:'must-not-store',note:'สวัสดี'}});
const signed=(raw,at=clock)=>`t=${Math.floor(at/1000)},v1=${createHmac('sha256',secret).update(String(Math.floor(at/1000))+'.').update(raw).digest('hex')}`;
function memoryStore(initial=null){let state=initial;return{load:()=>structuredClone(state),save:v=>{state=structuredClone(v);},close(){},get state(){return structuredClone(state);}};}
async function start(t,opts={}){const store=opts.store||memoryStore(),server=createLab({token,store,stripeSecret:secret,now:()=>clock,...opts});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;return{store,server,base,async post(raw,header=signed(raw),path='/ingress/stripe'){const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json','stripe-signature':header},body:raw});return{status:r.status,body:await r.json()};}};}
test('Stripe route disabled by default and requires persistent store',async t=>{assert.throws(()=>createLab({token,stripeSecret:secret}),/persistent/);const f=await start(t,{stripeSecret:null});assert.equal((await f.post('{}')).status,404);});
test('Stripe authenticates before parsing, rejects live/invalidschema and accepts sanitized test event',async t=>{
 const f=await start(t);assert.equal((await f.post('not JSON',`t=${clock/1000},v1=${'0'.repeat(64)}`)).status,401);assert.equal((await f.post('not JSON')).status,400);
 for(const e of [{...event(),livemode:true},{...event(),livemode:'false'},{...event(),object:'charge'}, {...event(),id:'ch_bad'},[],null])assert.equal((await f.post(JSON.stringify(e))).status,400);
 assert.equal((await f.post(JSON.stringify(event()))).status,201);assert.equal(f.store.state.events.length,1);assert.equal(f.store.state.events[0].payload.data.secret,'[REDACTED]');assert.equal(f.store.state.events[0].label,'Stripe test ingress');assert.match(f.store.state.receipts[0][0],/^stripe_[a-f0-9]{64}$/);
});
test('Stripe dedup/conflict persists and generic ID namespace cannot suppress Stripe event',async t=>{
 const f=await start(t,{ingressKey:genericKey}),raw=JSON.stringify(event());assert.equal((await f.post(raw)).status,201);assert.equal((await f.post(raw)).status,200);assert.equal((await f.post(JSON.stringify({...event(),extra:1}))).status,409);
 const id='evt_synthetic',stamp=String(clock/1000),body='{}',sig=createHmac('sha256',Buffer.from(genericKey,'hex')).update(stamp+'.'+id+'.'+body).digest('hex');const r=await fetch(f.base+'/ingress',{method:'POST',headers:{'content-type':'application/json','x-lab-timestamp':stamp,'x-lab-event-id':id,'x-lab-signature':'sha256='+sig},body});assert.equal(r.status,201);assert.equal(f.store.state.events.length,2);
 const g=await start(t,{store:memoryStore(f.store.state)});assert.equal((await g.post(raw)).status,200);assert.equal(g.store.state.events.length,2);
});
test('duplicate physical Stripe headers rejected even if combined value contains valid signature',async t=>{
 const f=await start(t),raw=JSON.stringify(event());const status=await new Promise((resolve,reject)=>{const q=http.request(f.base+'/ingress/stripe',{method:'POST',headers:['Host',new URL(f.base).host,'Content-Type','application/json','Stripe-Signature',signed(raw),'stripe-signature','v1='+('0'.repeat(64))]},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});q.on('error',reject);q.end(raw);});assert.equal(status,401);assert.equal(f.store.state,null);
});
test('Stripe retry re-signs the same event/body with fresh time without duplicate capture, including encrypted restart',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'hook-stripe-retry-')),path=join(dir,'inbox.enc'),key='cd'.repeat(32);let now=clock,g;
 const f=await start(t,{store:createStore({path,key}),now:()=>now}),raw=JSON.stringify(event('evt_retrysynthetic')),original=signed(raw,now);
 try {
  assert.equal((await f.post(raw,original)).status,201);now+=60000;const fresh=signed(raw,now);assert.notEqual(fresh,original);
  const retry=await f.post(raw,fresh);assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);
  // Even a retained ID must authenticate; stale signatures cannot probe receipts.
  now=clock+301000;assert.equal((await f.post(raw,original)).status,401);assert.equal((await f.post(raw,signed(raw,now))).status,200);
  await new Promise(resolve=>f.server.close(resolve));g=await start(t,{store:createStore({path,key}),now:()=>now});now+=1000;
  assert.equal((await g.post(raw,signed(raw,now))).status,200);
  const changed=JSON.stringify({...event('evt_retrysynthetic'),extra:1});assert.equal((await g.post(changed,signed(changed,now))).status,409);
  const response=await fetch(g.base+'/api/events',{headers:{authorization:'Bearer '+token}}),state=await response.json();assert.equal(state.events.length,1);assert.equal(state.events[0].payload.data.secret,'[REDACTED]');
 }finally{await new Promise(resolve=>f.server.close(resolve));if(g)await new Promise(resolve=>g.server.close(resolve));rmSync(dir,{recursive:true,force:true});}
});
test('Stripe shared signed budget remains bounded; failures cannot acknowledge persistence',async t=>{
 const f=await start(t),raw=JSON.stringify(event());assert.equal((await f.post(raw)).status,201);for(let i=1;i<120;i++)assert.equal((await f.post(raw)).status,200);assert.equal((await f.post(raw)).status,429);
 const broken=await start(t,{store:{load:()=>null,save(){throw Error('private error');},close(){}}});assert.equal((await broken.post(raw)).status,503);
});
test('Stripe captures persist only sanitized content in actual encrypted store',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'hook-stripe-'));const path=join(dir,'inbox.enc');const f=await start(t,{store:createStore({path,key:'cd'.repeat(32)})});t.after(()=>rmSync(dir,{recursive:true,force:true}));const raw=JSON.stringify(event());assert.equal((await f.post(raw)).status,201);const bytes=readFileSync(path);assert.equal(bytes.includes(Buffer.from('must-not-store')),false);assert.equal(bytes.includes(Buffer.from('evt_synthetic')),false);
});
test('cross-provider receipt probes never become a successful duplicate, including after rollback metadata loss',async t=>{
 const f=await start(t,{ingressKey:genericKey}),raw=JSON.stringify(event());assert.equal((await f.post(raw)).status,201);const reserved=f.store.state.receipts[0][0],stamp=String(clock/1000),sig=createHmac('sha256',Buffer.from(genericKey,'hex')).update(stamp+'.'+reserved+'.'+raw).digest('hex');const r=await fetch(f.base+'/ingress',{method:'POST',headers:{'content-type':'application/json','x-lab-timestamp':stamp,'x-lab-event-id':reserved,'x-lab-signature':'sha256='+sig},body:raw});assert.equal(r.status,409);
 const old=f.store.state;delete old.receiptProviders;const g=await start(t,{store:memoryStore(old)});assert.equal((await g.post(raw)).status,409);assert.equal(g.store.state.events.length,1);
 const legacy=memoryStore({version:1,events:[],receipts:[[reserved,clock]],receiptHashes:[[reserved,'a'.repeat(64)]]}),h=await start(t,{store:legacy});assert.equal((await h.post(raw)).status,409);
});
test('Stripe-only service reports enabled ingress without leaking its secret',async t=>{const f=await start(t);for(const path of ['/api/events','/api/diagnostics']){const r=await fetch(f.base+path,{headers:{authorization:'Bearer '+token}}),body=await r.text();assert.equal(r.status,200);assert.equal(body.includes(secret),false);assert.equal(JSON.parse(body).ingressEnabled,true);}});
