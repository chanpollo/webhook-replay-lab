import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {localJSON} from '../src/local-api.js';
import {checkAlerts} from '../bin/alerts.mjs';
import {createLab} from '../src/server.js';
import {digest} from '../src/core.js';
const token='synthetic-direct-client-token-000000';
async function listen(t,server){const sockets=new Set();server.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{for(const socket of sockets)socket.destroy();server.closeAllConnections();server.close(resolve);}));return 'http://127.0.0.1:'+server.address().port;}
test('direct local client bounds responses/time and refuses redirects, remote bases and malformed responses',async t=>{
 let mode='ok',requests=0;const base=await listen(t,http.createServer((req,res)=>{requests++;assert.equal(req.headers.authorization,'Bearer '+token);if(mode==='redirect'){res.writeHead(302,{location:'https://never-contact.example.test'});res.end();}else if(mode==='large')res.end('x'.repeat(16385));else if(mode==='bad')res.end('private-response-not-json');else if(mode==='slow')res.writeHead(200);else if(mode==='truncated'){res.writeHead(200,{'content-length':100});res.write('{}');res.destroy();}else res.end(JSON.stringify({ok:true}));}));
 assert.deepEqual(await localJSON({base,path:'/api/diagnostics',token}),{status:200,data:{ok:true}});
 mode='redirect';assert.equal((await localJSON({base,path:'/api/diagnostics',token})).status,302);assert.equal((await checkAlerts({base,token})).result.ok,false);
 for(mode of ['large','bad','truncated']){await assert.rejects(localJSON({base,path:'/api/diagnostics',token}),/unavailable or invalid/);assert.equal((await checkAlerts({base,token})).result.ok,false);}
 mode='slow';await assert.rejects(localJSON({base,path:'/api/diagnostics',token,timeoutMs:25}),/unavailable or invalid/);
 const before=requests;for(const candidate of ['https://example.com','http://127.0.0.1/path','http://secret@127.0.0.1','http://127.0.0.1?secret'])assert.throws(()=>localJSON({base:candidate,path:'/api/diagnostics',token}));assert.equal(requests,before);
 assert.throws(()=>localJSON({base,path:'//example.com',token}));assert.throws(()=>localJSON({base,path:'/api/diagnostics',token:token+'\r\nsecret'}));
});
test('alert and fixture CLIs never send bearer credentials through an opted-in environment proxy',async t=>{
 let proxyRequests=0,proxySawToken=false,sends=0;
 const trap=http.createServer((req,res)=>{proxyRequests++;proxySawToken||=req.headers.authorization==='Bearer '+token;res.writeHead(502,{'connection':'close'});res.end();});
 trap.on('connect',(req,socket)=>{proxyRequests++;socket.setTimeout(2000,()=>socket.destroy());socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');let headers='';socket.on('data',chunk=>{headers+=chunk.toString();if(headers.length>16384)return socket.destroy();if(headers.includes('\r\n\r\n')){proxySawToken||=headers.includes('Bearer '+token);socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');}});});
 const proxy=await listen(t,trap);const target='https://staging.example.test/hook';
 const base=await listen(t,createLab({token,allowlist:[target],resolve:async()=>({}),send:async()=>{sends++;return {status:204};}}));
 const directory=mkdtempSync(join(tmpdir(),'hook-direct-'));t.after(()=>rmSync(directory,{recursive:true,force:true}));const file=join(directory,'fixture.json'),payload={synthetic:true};writeFileSync(file,JSON.stringify({version:1,payload,sha256:digest(payload)}));
 const env={...process.env,LAB_TOKEN:token,LAB_TOKEN_FILE:undefined,LAB_ALERT_BASE:base,NODE_USE_ENV_PROXY:'1',HTTP_PROXY:proxy,http_proxy:proxy,HTTPS_PROXY:proxy,https_proxy:proxy,NO_PROXY:'',no_proxy:''};delete env.LAB_TOKEN_FILE;
 const run=args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{env,stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>{child.kill('SIGKILL');reject(Error('Synthetic CLI timeout'));},5000);let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',status=>{clearTimeout(timer);resolve({status,stdout,stderr});});});
 if(Number(process.versions.node.split('.')[0])>=24){const control=await run(['--input-type=module','-e',`const r=await fetch(${JSON.stringify(base+'/api/diagnostics')},{headers:{authorization:${JSON.stringify('Bearer '+token)}},signal:AbortSignal.timeout(2000)});console.log(r.status);`]);assert.equal(control.status,0,control.stderr);assert.equal(control.stdout.trim(),'502');assert.ok(proxyRequests>0);assert.equal(proxySawToken,true);proxyRequests=0;}
 const alert=await run(['bin/alerts.mjs']);assert.equal(alert.status,0,alert.stderr);assert.equal(JSON.parse(alert.stdout).ok,true);
 const replay=await run(['bin/fixtures.mjs','replay',file,'--server',base,'--target',target,'--confirm','SEND TO STAGING']);assert.equal(replay.status,0,replay.stderr+replay.stdout);assert.equal(JSON.parse(replay.stdout).status,204);assert.equal(sends,1);assert.equal(proxyRequests,0);
});
