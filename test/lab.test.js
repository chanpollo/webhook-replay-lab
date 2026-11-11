import test from 'node:test';
import http from 'node:http';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import assert from 'node:assert/strict';
import {redact,publicIPv4,targetURL,resolveTarget,differences,transmit} from '../src/core.js';
import {createLab} from '../src/server.js';
const url='https://staging.example.com/hook',token='x'.repeat(40);
test('nested secrets and email addresses are sanitized',()=>assert.deepEqual(redact({authorization:'secret',items:[{email:'a@b.com',name:'hello a@b.com',nested:{api_key:'bad'}}]}),{authorization:'[REDACTED]',items:[{email:'[REDACTED]',name:'hello [EMAIL]',nested:{api_key:'[REDACTED]'}}]}));
test('special address ranges and IPv6 fail closed',()=>{for(const ip of ['127.0.0.1','10.0.0.1','172.16.1.1','192.168.1.1','169.254.169.254','100.100.100.200','0.0.0.0','198.19.1.1','192.0.0.9','192.0.2.3','203.0.113.1','224.0.0.1','255.255.255.255','::1','::ffff:127.0.0.1','2001:4860:4860::8888'])assert.equal(publicIPv4(ip),false,ip);assert.equal(publicIPv4('8.8.8.8'),true);});
test('only exact approved HTTPS URL permitted',()=>{assert.equal(targetURL(url,[url]).href,url);for(const s of ['http://staging.example.com/hook',url+'?secret=x',url+'#x','https://user:pass@staging.example.com/hook','https://127.0.0.1/','https://staging.example.com:444/hook',url+'/other'])assert.throws(()=>targetURL(s,[url]));});
test('DNS validates every answer, pins public address, rejects mixed/private answers',async()=>{const target=await resolveTarget(url,[url],async()=>[{address:'8.8.8.8',family:4}]);assert.equal(target.address,'8.8.8.8');await assert.rejects(resolveTarget(url,[url],async()=>[{address:'8.8.8.8'},{address:'127.0.0.1'}]));await assert.rejects(resolveTarget(url,[url],async()=>[]));});
test('comparison handles nested changes',()=>assert.deepEqual(differences({a:{b:1}},{a:{b:2}}),[{path:'$.a.b',before:1,after:2}]));
async function fixture(t,options={}){let time=Date.now(),calls=[];const server=createLab({token,allowlist:[url],now:()=>time,resolve:async()=>({url:new URL(url),address:'8.8.8.8'}),send:async(target,body)=>{calls.push({target,body});return{status:202,durationMs:1,redirectBlocked:false};},...options});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));const base='http://127.0.0.1:'+server.address().port;const request=async(path,body,headers={})=>{const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};return {server,base,request,calls,advance:n=>time+=n};}
test('private capture, sanitized export, diff and deletion',async t=>{const f=await fixture(t);assert.equal((await f.request('events',null,{authorization:''})).status,401);assert.equal((await f.request('events',null,{origin:'https://evil.example'})).status,403);assert.equal(await new Promise(resolve=>{http.get(f.base+'/api/events',{headers:{host:'evil.example',authorization:'Bearer '+token}},res=>{res.resume();resolve(res.statusCode);});}),403);const a=await f.request('events',{payload:{token:'no',value:1}});assert.equal(a.status,201);assert.equal(a.data.payload.token,'[REDACTED]');const b=await f.request('events',{payload:{token:'other',value:2}});assert.equal((await f.request('compare',{a:a.data.id,b:b.data.id})).data.differences.length,1);const ex=await f.request(`events/${a.data.id}/fixture`);assert.equal(ex.data.payload.token,'[REDACTED]');assert.equal(ex.data.sha256.length,64);await f.request('delete',{id:a.data.id});assert.equal((await f.request(`events/${a.data.id}/fixture`)).status,404);});
test('confirmed single-use replay calls injected transport once with sanitized payload',async t=>{const f=await fixture(t);const event=(await f.request('events',{payload:{secret:'bad',value:1}})).data;const approval=(await f.request('prepare',{id:event.id,url})).data;assert.equal((await f.request('replay',{nonce:approval.nonce,confirm:'no'})).status,400);const result=await f.request('replay',{nonce:approval.nonce,confirm:'SEND TO STAGING'});assert.equal(result.data.status,202);assert.equal(f.calls.length,1);assert.equal(f.calls[0].body.secret,'[REDACTED]');assert.equal((await f.request('replay',{nonce:approval.nonce,confirm:'SEND TO STAGING'})).status,400);});
test('expired confirmation and retention prevent replay',async t=>{const f=await fixture(t);const event=(await f.request('events',{payload:{v:1}})).data;const a=(await f.request('prepare',{id:event.id,url})).data;f.advance(60001);assert.equal((await f.request('replay',{nonce:a.nonce,confirm:'SEND TO STAGING'})).status,400);f.advance(24*60*60*1000);assert.equal((await f.request('events')).data.events.length,0);assert.equal(f.calls.length,0);});
test('DNS denial blocks transmission and consumed approval cannot retry',async t=>{const f=await fixture(t,{resolve:async()=>{throw Error('Private DNS denied');}});const e=(await f.request('events',{payload:{v:1}})).data;const a=(await f.request('prepare',{id:e.id,url})).data;assert.equal((await f.request('replay',{nonce:a.nonce,confirm:'SEND TO STAGING'})).data.outcome,'blocked');assert.equal(f.calls.length,0);});
test('transport errors are unknown-delivery, never auto-retried',async t=>{let attempts=0;const f=await fixture(t,{send:async()=>{attempts++;throw Error('timeout');}});const e=(await f.request('events',{payload:{v:1}})).data;const a=(await f.request('prepare',{id:e.id,url})).data;assert.equal((await f.request('replay',{nonce:a.nonce,confirm:'SEND TO STAGING'})).data.outcome,'unknown_delivery');assert.equal(attempts,1);});

test('transport pins DNS, preserves TLS hostname, and does not follow redirects',async t=>{
  let count=0;
  t.mock.method(https,'request',(url,options,callback)=>{
    count++;assert.equal(url.hostname,'staging.example.com');assert.equal(options.agent,false);
    options.lookup('staging.example.com',{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'8.8.8.8');assert.equal(family,4);});
    assert.equal(options.headers.authorization,undefined);
    const req=new EventEmitter();req.destroy=()=>req.emit('close');req.end=()=>queueMicrotask(()=>{const res=new EventEmitter();res.statusCode=302;res.headers={location:'http://169.254.169.254/'};res.resume=()=>{};callback(res);res.emit('end');req.emit('close');});return req;
  });
  const result=await transmit({url:new URL(url),address:'8.8.8.8'},{synthetic:true});assert.equal(result.redirectBlocked,true);assert.equal(count,1);
});
test('event capacity and rate limits are enforced',async t=>{
  const f=await fixture(t);
  for(let i=0;i<200;i++){if(i===110)f.advance(60001);assert.equal((await f.request('events',{payload:{i}})).status,201);}
  assert.equal((await f.request('events',{payload:{i:201}})).status,409);
  for(let i=0;i<29;i++)await f.request('events');
  assert.equal((await f.request('events')).status,429);
});
test('payload and pending-confirmation limits fail closed',async t=>{
 const f=await fixture(t);
 const event=(await f.request('events',{payload:{x:1}})).data;
 for(let i=0;i<100;i++)assert.equal((await f.request('prepare',{id:event.id,url})).status,200);
 assert.equal((await f.request('prepare',{id:event.id,url})).status,429);
});
test('capture preserves UTF-8 when a character spans network chunks',async t=>{
 const f=await fixture(t);
 const body=Buffer.from(JSON.stringify({payload:{message:'สวัสดี'}}));
 const split=body.indexOf(Buffer.from('ส'))+1;
 const result=await new Promise((resolve,reject)=>{
  const req=http.request(f.base+'/api/events',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'}},res=>{let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve(JSON.parse(data)));});
  req.on('error',reject);req.write(body.subarray(0,split));setTimeout(()=>req.end(body.subarray(split)),20);
 });
 assert.equal(result.payload.message,'สวัสดี');
});
