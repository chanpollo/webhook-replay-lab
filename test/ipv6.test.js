import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {EventEmitter} from 'node:events';
import {publicIPv6,targetURL,resolveTarget,transmit} from '../src/core.js';
const url='https://staging.example.com/receiver';
test('IPv6 ordinary global unicast accepts equivalent canonical representations',()=>{
 for(const ip of ['2606:4700::6810:e784','2001:4860:4860::8888','2606:4700:0000:0000:0000:0000:6810:E784'])assert.equal(publicIPv6(ip),true,ip);
});
test('IPv6 special-purpose, mapped, transition, scope and malformed addresses fail closed',()=>{
 for(const ip of ['::','::1','::ffff:127.0.0.1','::ffff:7f00:1','::8.8.8.8','64:ff9b::808:808','64:ff9b:1::a00:1','100::1','100:0:0:1::1','2001::1','2001:1::1','2001:2::1','2001:3::1','2001:4:112::1','2001:10::1','2001:20::1','2001:30::1','2001:1ff:ffff::1','2001:db8::1','2002:0808:0808::1','2620:4f:8000::1','3fff::1','3fff:fff:ffff::1','5f00::1','fc00::1','fdff::1','fe80::1','ff02::1','2606:4700::1%eth0','2606:4700::8.8.8.8','2606:::1','2606:xyz::1','2606::1::1','8.8.8.8','',null])assert.equal(publicIPv6(ip),false,String(ip));
});
test('DNS validates all families before preferring public IPv4 and pins IPv6-only answer',async()=>{
 let calls=0;const both=await resolveTarget(url,[url],async()=>{calls++;return [{address:'2606:4700::6810:e784',family:6},{address:'104.16.231.132',family:4}];});assert.equal(both.family,4);assert.equal(calls,1);
 const v6=await resolveTarget(url,[url],async()=>[{address:'2606:4700::6810:e784',family:6}]);assert.equal(v6.family,6);
 for(const bad of ['::1','fc00::1','2001:db8::1','::ffff:7f00:1'])await assert.rejects(resolveTarget(url,[url],async()=>[{address:'8.8.8.8',family:4},{address:bad,family:6}]),/non-public/);
 await assert.rejects(resolveTarget(url,[url],async()=>[{address:'2606:4700::1',family:4}]),/unsupported/);
});
test('IPv6 transport pins exact address and family without changing TLS hostname or resolving again',async t=>{
 let n=0;t.mock.method(https,'request',(u,o,cb)=>{n++;assert.equal(u.hostname,'staging.example.com');assert.equal(o.family,6);assert.equal(o.agent,false);assert.notEqual(o.rejectUnauthorized,false);
 for(const all of [true,false])o.lookup('a-rebound-name.invalid',{all},(err,address,family)=>{assert.equal(err,null);if(all)assert.deepEqual(address,[{address:'2606:4700::6810:e784',family:6}]);else {assert.equal(address,'2606:4700::6810:e784');assert.equal(family,6);}});
 const q=new EventEmitter();q.destroy=()=>q.emit('close');q.end=()=>queueMicrotask(()=>{const r=new EventEmitter();r.statusCode=302;r.resume=()=>{};cb(r);r.emit('end');q.emit('close');});return q;});
 const result=await transmit({url:new URL(url),address:'2606:4700::6810:e784',family:6},{synthetic:true});assert.equal(result.redirectBlocked,true);assert.equal(n,1);
});

test('IPv6 literal URLs are rejected even when operator allowlisted',()=>{for(const url of ['https://[2606:4700::1111]/','https://[::1]/'])assert.throws(()=>targetURL(url,[url]),/hostname/);});
test('IPv6 conservative CIDR boundaries',()=>{for(const [ip,want] of [['1fff:ffff::1',false],['2000::1',true],['2001:1ff:ffff::1',false],['2001:200::1',true],['2001:db7:ffff::1',true],['2001:db8:ffff::1',false],['2001:db9::1',true],['2620:4f:7fff::1',true],['2620:4f:8000:ffff::1',false],['2620:4f:8001::1',true],['3fff:fff:ffff::1',false],['3fff:1000::1',true],['4000::1',false]])assert.equal(publicIPv6(ip),want,ip);});
