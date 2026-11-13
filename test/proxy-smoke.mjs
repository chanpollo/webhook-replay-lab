// Actual recipe, isolated Docker network namespace; never publishes host ports.
import assert from 'node:assert/strict';import {execFileSync,spawnSync} from 'node:child_process';import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {fileURLToPath} from 'node:url';import {randomUUID,createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const image=process.env.LAB_TEST_IMAGE||'webhook-replay-lab:proxy-test';
const proxyImage='caddy:2.11.9-alpine@sha256:fc9cbc100585871d18d4e451cca7021785c90a7006087427ae5ceb3e4efe6424';
const temp=mkdtempSync(join(tmpdir(),'hook-proxy-')),prefix='hook-proxy-'+randomUUID();
const run=args=>execFileSync('docker',args,{cwd:root,encoding:'utf8',timeout:180000,stdio:['ignore','pipe','pipe'],maxBuffer:4*1024*1024});
let volume,lab,proxy;let failed=false;
const label='hook.test-run='+prefix;
const configMount=join(temp,'Caddyfile')+':/etc/caddy/Caddyfile:ro';
const proxyIsolation=['--platform','linux/amd64','--user','65532:65532','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','128m','--pids-limit','64','--tmpfs','/data:rw,noexec,nosuid,size=8m,mode=1777','--tmpfs','/config:rw,noexec,nosuid,size=8m,mode=1777','-v',configMount];
try{
 const recipe=readFileSync(join(root,'deploy/Caddyfile.example'),'utf8');
 assert.equal((recipe.match(/^webhooks\.example\.com \{/gm)||[]).length,1,'recipe must contain one explicit hostname to transform');
 const config=recipe.replace(/^webhooks\.example\.com \{/m,':8080 {').replace(/^\{\n/m,'{\n    admin off\n    auto_https off\n');
 writeFileSync(join(temp,'Caddyfile'),config,{mode:0o644});
 if(!process.env.LAB_TEST_IMAGE)run(['build','-t',image,'.']);
 run(['pull','--platform','linux/amd64',proxyImage]);
 run(['run','--rm','--name',prefix+'-validate','--label',label,'--network','none',...proxyIsolation,proxyImage,'caddy','validate','--config','/etc/caddy/Caddyfile','--adapter','caddyfile']);
 volume=run(['volume','create','--label',label,prefix+'-data']).trim();assert.equal(volume,prefix+'-data');
 lab=run(['run','-d','--name',prefix+'-lab','--label',label,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','256m','--pids-limit','64','-v',volume+':/data','-e','LAB_TOKEN=synthetic-proxy-admin-token-000000000','-e','LAB_STORAGE_KEY='+'ab'.repeat(32),'-e','LAB_INGRESS_KEY='+'cd'.repeat(32),'-e','LAB_DATA_PATH=/data/inbox.enc','-e','LAB_STRIPE_SECRET=whsec_synthetic_proxy_test_000000000000000',image]).trim();
 proxy=run(['run','-d','--name',prefix+'-caddy','--label',label,'--network','container:'+lab,...proxyIsolation,proxyImage,'caddy','run','--config','/etc/caddy/Caddyfile','--adapter','caddyfile']).trim();
 const inspect=JSON.parse(run(['inspect',lab,proxy]));assert.equal(inspect[0].HostConfig.NetworkMode,'none');assert.equal(inspect[1].HostConfig.NetworkMode,'container:'+lab);for(const c of inspect)assert.ok(!c.HostConfig.PortBindings||Object.keys(c.HostConfig.PortBindings).length===0,'no published host ports');
 const probe=String.raw`
 import http from 'node:http';import {createHmac} from 'node:crypto';import assert from 'node:assert/strict';
 const body=JSON.stringify({synthetic:'proxy-case',secret:'redact-this'}),stamp=String(Math.floor(Date.now()/1000));
 function headers(id='proxy-synthetic',raw=body){return {'content-type':'application/json','x-lab-timestamp':stamp,'x-lab-event-id':id,'x-lab-signature':'sha256='+createHmac('sha256',Buffer.from('cd'.repeat(32),'hex')).update(stamp+'.'+id+'.'+raw).digest('hex')};}
 function request(path,{method='POST',body:raw=(method==='GET'||method==='HEAD')?'':body,headers:extra={},chunked=false,port=8080}={}){return new Promise((resolve,reject)=>{const q=http.request({host:'127.0.0.1',port,path,method,headers:{...headers(),...(!chunked?{'content-length':Buffer.byteLength(raw)}:{}),...extra},timeout:12000},r=>{let out='';r.on('data',c=>{out+=c;if(out.length>131072)r.destroy(Error('response too large'));});r.on('end',()=>resolve({status:r.statusCode,body:out}));r.on('error',reject);});q.on('error',reject);q.on('timeout',()=>q.destroy(Error('request timeout')));if(chunked){q.write(raw.slice(0,32000));q.end(raw.slice(32000));}else q.end(raw);});}
 let ready=false;for(let i=0;i<30;i++){try{if((await request('/healthz',{method:'GET',body:'',port:4319})).status===200&&(await request('/',{method:'GET',body:''})).status===404){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert.equal(ready,true,'lab/proxy readiness');
 const accepted=await request('/ingress');assert.equal(accepted.status,201,'raw HMAC must survive proxy unchanged');const duplicate=await request('/ingress');assert.equal(duplicate.status,200,'same signed event is idempotent capture');
 const stripeSecret='whsec_synthetic_proxy_test_000000000000000';
 function stripeHeaders(raw){return {'stripe-signature':'t='+stamp+',v1='+createHmac('sha256',stripeSecret).update(stamp+'.'+raw).digest('hex')};}
 const stripeBody=JSON.stringify({id:'evt_proxySynthetic1',object:'event',livemode:false,type:'test.synthetic',data:{object:{secret:'redact-this'}}});
 assert.equal((await request('/ingress/stripe',{body:stripeBody,headers:stripeHeaders(stripeBody)})).status,201,'signed Stripe test event');
 assert.equal((await request('/ingress/stripe',{body:stripeBody,headers:stripeHeaders(stripeBody)})).status,200,'Stripe duplicate');
 assert.equal((await request('/ingress/stripe',{body:stripeBody,headers:{'stripe-signature':'t='+stamp+',v1='+'00'.repeat(32)}})).status,401,'Stripe forged signature');
 const liveBody=JSON.stringify({id:'evt_proxyLive1',object:'event',livemode:true});assert.equal((await request('/ingress/stripe',{body:liveBody,headers:stripeHeaders(liveBody)})).status,400,'Stripe live-mode rejected');
 for(const method of ['GET','PUT','PATCH','DELETE','OPTIONS','HEAD'])assert.equal((await request('/ingress/stripe',{method})).status,404,'Stripe '+method);
 for(const path of ['/ingress/stripe/','/ingress/stripe?x=1','/ingress/stripe?','/ingress/%73tripe','/ingress/./stripe','/ingress/x/../stripe'])assert.equal((await request(path)).status,404,path);
 const paths=['/','/app.js','/style.css','/analytics.js','/healthz','/api/events','/api/diagnostics','/api/replay'];
 for(const path of paths)for(const method of ['GET','POST'])assert.equal((await request(path,{method,headers:{authorization:'Bearer synthetic-proxy-admin-token-000000000','x-original-url':'/ingress','x-rewrite-url':'/ingress','x-forwarded-host':'localhost','x-forwarded-proto':'http'}})).status,404,path+' '+method);
 for(const method of ['GET','PUT','PATCH','DELETE','OPTIONS','HEAD'])assert.equal((await request('/ingress',{method})).status,404,method);
 for(const path of ['/ingress/','/ingress?x=1','/ingress?','/%69ngress','/ing%72ess','//ingress','/./ingress','/x/../ingress','/ingress/.','/ingress%2f','/ingress%3f'])assert.equal((await request(path)).status,404,path);
 assert.equal((await request('/ingress',{headers:{origin:'https://hostile.example'}})).status,403,'Origin is not stripped to bypass app checks');
 assert.equal((await request('/ingress',{headers:{'x-lab-signature':'sha256='+'00'.repeat(32)}})).status,401,'forged signature');
 const large=JSON.stringify({synthetic:'x'.repeat(65536)});const oversized=await request('/ingress',{body:large,headers:headers('proxy-large',large),chunked:true});assert.equal(oversized.status,413,'chunked body is bounded');
 const state=await request('/api/events',{method:'GET',body:'',port:4319,headers:{authorization:'Bearer synthetic-proxy-admin-token-000000000'}});assert.equal(state.status,200);const events=JSON.parse(state.body).events;assert.equal(events.length,2,'negative cases must not capture');assert.ok(events.every(e=>e.payload.secret==='[REDACTED]'||e.payload.data?.object?.secret==='[REDACTED]'));
 console.log(JSON.stringify({ok:true,accepted:201,duplicate:200,privateRouteCases:paths.length*2,methodCases:12,uriCases:17,stripeAccepted:201,stripeDuplicate:200,stripeForgedSignature:401,stripeLivemodeDenied:400,forgedSignature:401,originDenied:403,oversizedChunked:413,retainedEvents:events.length,externalNetwork:false,publishedPorts:false}));
 `;
 const output=run(['exec',lab,'node','--input-type=module','-e',probe]);process.stdout.write(output);console.log(JSON.stringify({proxyImage,recipeSha256:createHash('sha256').update(recipe).digest('hex'),testTransport:'isolated HTTP; external TLS not claimed'}));
}catch(error){failed=true;for(const name of [prefix+'-validate',prefix+'-caddy',prefix+'-lab']){try{const meta=JSON.parse(run(['inspect',name]))[0];if(meta.Config?.Labels?.['hook.test-run']===prefix){const result=spawnSync('docker',['logs','--tail','15',name],{encoding:'utf8',timeout:10000,maxBuffer:1024*1024});const log=((result.stdout||'')+(result.stderr||'')).replaceAll('synthetic-proxy-admin-token-000000000','[SYNTHETIC_TOKEN]').replaceAll('ab'.repeat(32),'[SYNTHETIC_KEY]').replaceAll('cd'.repeat(32),'[SYNTHETIC_KEY]').replaceAll('whsec_synthetic_proxy_test_000000000000000','[SYNTHETIC_STRIPE_SECRET]');console.error('Temporary test log:',log.slice(-10000));}}catch{}}throw error;}finally{
 const cleanupErrors=[];
 for(const name of [prefix+'-validate',prefix+'-caddy',prefix+'-lab']){
  try{let meta;try{meta=JSON.parse(run(['inspect',name]))[0];}catch(error){if(error.status===1)continue;throw error;}
   assert.equal(meta.Config?.Labels?.['hook.test-run'],prefix,'refuse to remove unowned container');run(['rm','-f',name]);
   const remaining=run(['ps','-aq','--filter','name=^/'+name+'$']).trim();assert.equal(remaining,'','temporary container remains');
  }catch{cleanupErrors.push('owned temporary container removal/verification failed');}
 }
 try{let meta;try{meta=JSON.parse(run(['volume','inspect',prefix+'-data']))[0];}catch(error){if(error.status!==1)throw error;}
  if(meta){assert.equal(meta.Labels?.['hook.test-run'],prefix,'refuse to remove unowned volume');run(['volume','rm',prefix+'-data']);const left=run(['volume','ls','-q','--filter','name=^'+prefix+'-data$']).trim();assert.equal(left,'','temporary volume remains');}
 }catch{cleanupErrors.push('owned temporary volume removal/verification failed');}
 rmSync(temp,{recursive:true,force:true});if(cleanupErrors.length){console.error(cleanupErrors.join('; '));if(!failed)throw Error('Proxy test cleanup incomplete');}
}
