import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
import {createStripeVerifier} from '../src/provider-signatures.js';
const secret='whsec_synthetic_only_not_an_account_secret',timestamp=1800000000,rawBody=Buffer.from('{"id":"evt_synthetic","livemode":false,"message":"สวัสดี"}\n');
const sign=(raw=rawBody,time=timestamp,key=secret)=>createHmac('sha256',Buffer.from(key,'utf8')).update(String(time)+'.','ascii').update(raw).digest('hex');
const header=(raw=rawBody,time=timestamp)=>`t=${time},v1=${sign(raw,time)}`;
const request=overrides=>({rawBody,signatureHeader:header(),headerCount:1,...overrides});
const verify=()=>createStripeVerifier({secret,now:()=>timestamp*1000});
test('Stripe signature authenticates raw UTF-8 bytes with literal whsec secret',()=>{
 assert.deepEqual(verify()(request()),{provider:'stripe',timestamp});
 assert.throws(()=>verify()(request({signatureHeader:`t=${timestamp},v1=${sign(rawBody,timestamp,secret.slice(6))}`})),/Invalid/);
 assert.throws(()=>verify()(request({rawBody:Buffer.from(JSON.stringify(JSON.parse(rawBody)))})),/Invalid/);
 assert.throws(()=>verify()(request({rawBody:Buffer.from(rawBody.toString().replace('false','true'))})),/Invalid/);
});
test('multiple v1 signatures accept any matching entry without exposing match index',()=>{
 const wrong='0'.repeat(64),good=sign();
 for(const values of [`v1=${wrong},v1=${good}`,`v1=${good},v1=${wrong}`,`v0=${wrong},v1=${good}`,`v1=${good.toUpperCase()}`])assert.deepEqual(verify()(request({signatureHeader:`t=${timestamp}, ${values}`})),{provider:'stripe',timestamp});
 assert.throws(()=>verify()(request({signatureHeader:`t=${timestamp},v0=${good}`})),/Invalid/);
});
test('Stripe timestamp fixed symmetric tolerance and strict canonical integer',()=>{
 for(const delta of [-299,299])assert.ok(verify()(request({signatureHeader:header(rawBody,timestamp+delta)})));
 for(const delta of [-300,300,-301,301])assert.throws(()=>verify()(request({signatureHeader:header(rawBody,timestamp+delta)})),/Invalid/);
 for(const value of ['01800000000','1800000000x','1800000000.0','+1800000000','-1','1e9','9007199254740992',''])assert.throws(()=>verify()(request({signatureHeader:`t=${value},v1=${sign()}`})),/Invalid/);
 for(const now of [()=>NaN,()=>Infinity,()=>timestamp*1000+.5,()=>-1])assert.throws(()=>createStripeVerifier({secret,now})(request()),/Invalid/);
});
test('duplicate physical headers, duplicate t and malformed signature fields fail closed',()=>{
 for(const count of [undefined,0,2,'1'])assert.throws(()=>verify()(request({headerCount:count})),/Invalid/);
 for(const signatureHeader of [[header()],`t=${timestamp},t=${timestamp},v1=${sign()}`,`t=${timestamp},v1=xx`,`t=${timestamp},v1=${sign()}0`,`t=${timestamp},v1=${sign()},`,`t=${timestamp},v1=${sign()}\r\n`,`t=${timestamp},v1=${sign()},bad=x`,`t=${timestamp}, v1 =${sign()}`,`t=${timestamp},v1=${sign()},v2=nothex`])assert.throws(()=>verify()(request({signatureHeader})),/Invalid/);
});
test('bounded header, field/signature count and raw body limits',()=>{
 const check=verify();assert.ok(check(request({signatureHeader:`t=${timestamp},`+Array(8).fill('v1='+sign()).join(',')})));
 assert.throws(()=>check(request({signatureHeader:`t=${timestamp},`+Array(9).fill('v1='+sign()).join(',')})),/Invalid/);
 assert.throws(()=>check(request({signatureHeader:`t=${timestamp},v1=${sign()},`+Array(15).fill('v0=00').join(',')})),/Invalid/);
 assert.throws(()=>check(request({signatureHeader:'x'.repeat(4097)})),/Invalid/);
 for(const raw of [Buffer.alloc(0),Buffer.alloc(65537),rawBody.toString(),new Uint8Array(rawBody),{}])assert.throws(()=>check(request({rawBody:raw})),/Invalid/);
 const raw=Buffer.alloc(65536,120);assert.ok(check(request({rawBody:raw,signatureHeader:header(raw)})));
});
test('verifier authenticates bytes, not JSON or Stripe test-mode authorization',()=>{
 const raw=Buffer.from('not JSON');assert.ok(verify()(request({rawBody:raw,signatureHeader:header(raw)})));
 const live=Buffer.from('{"livemode":true}');assert.ok(verify()(request({rawBody:live,signatureHeader:header(live)})));
 // Caller must parse and enforce livemode:false after authentication, not infer from secret prefix.
});
test('failure returns no payload, key, header or detailed signature material',()=>{
 const signatureHeader=`t=${timestamp},v1=${'0'.repeat(64)}`;try{verify()(request({signatureHeader}));assert.fail();}catch(error){assert.equal(error.message,'Invalid Stripe webhook signature');assert.equal(error.message.includes(secret),false);assert.equal(error.message.includes(rawBody.toString()),false);assert.equal(error.message.includes(signatureHeader),false);}
 for(const secret of ['',null,'sk_test_synthetic','whsec_short','whsec_'+('a'.repeat(257)),'whsec_'+('a'.repeat(16))+'\n'])assert.throws(()=>createStripeVerifier({secret}),/configuration/);
});
