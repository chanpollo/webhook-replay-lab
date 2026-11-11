// Real HTTPS sockets, ephemeral local CA, and controlled loopback receivers only.
// The loopback target is injected solely in this test; production resolveTarget still rejects it.
import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {execFileSync,spawn} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLab} from '../src/server.js';
import {resolveTarget} from '../src/core.js';

const moduleURL=new URL('../src/core.js',import.meta.url).href;
async function setup(t) {
  const dir=mkdtempSync(join(tmpdir(),'lab-tls-'));
  t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const cert=join(dir,'cert.pem'),key=join(dir,'key.pem');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',cert,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost'],{stdio:'ignore'});
  const requests=[];
  const receiver=https.createServer({cert:readFileSync(cert),key:readFileSync(key)},(req,res)=>{
    const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{
      requests.push({url:req.url,headers:req.headers,body:JSON.parse(Buffer.concat(chunks))});
      if(req.url==='/redirect'){res.writeHead(302,{location:'/must-not-follow'});return res.end();}
      if(req.url==='/oversize')return res.end('x'.repeat(65537));
      if(req.url==='/disconnect'){res.writeHead(200,{'content-length':100});res.write('short');return setTimeout(()=>res.destroy(),20);}
      if(req.url==='/timeout')return;
      res.writeHead(202);res.end('accepted');
    });
  });
  await new Promise(r=>receiver.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>{receiver.closeAllConnections();receiver.close(r);}));
  const base='https://localhost:'+receiver.address().port;
  const send=(path,body={synthetic:true},options={attemptId:'test-attempt-001'},trust=true)=>new Promise((resolve,reject)=>{
    const env={...process.env};delete env.NODE_TLS_REJECT_UNAUTHORIZED;delete env.NODE_EXTRA_CA_CERTS;
    if(trust)env.NODE_EXTRA_CA_CERTS=cert;
    const child=spawn(process.execPath,['--input-type=module','-e',`
      import {transmit} from ${JSON.stringify(moduleURL)};
      try { console.log(JSON.stringify({result:await transmit({url:new URL(process.argv[1]),address:'127.0.0.1'},JSON.parse(process.argv[2]),JSON.parse(process.argv[3]))})); }
      catch(error) { console.log(JSON.stringify({error:error.message})); }
    `,path.startsWith('https:')?path:base+path,JSON.stringify(body),JSON.stringify(options)],{env,stdio:['ignore','pipe','pipe']});
    let output='',stderr='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>stderr+=c);
    child.on('error',reject);child.on('exit',code=>{if(code!==0)return reject(Error(stderr||'probe failed'));try{const parsed=JSON.parse(output);parsed.error?reject(Error(parsed.error)):resolve(parsed.result);}catch(e){reject(e);}});
  });
  return {send,requests,base};
}
test('real TLS replay sends only sanitized JSON and persisted attempt correlation through private API',async t=>{
  const f=await setup(t),token='synthetic-local-transport-token-000000',url='https://staging.example.test/hook';
  const server=createLab({token,allowlist:[url],resolve:async()=>({}),send:(_target,body,options)=>f.send('/accepted',body,options)});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
  const base='http://127.0.0.1:'+server.address().port;
  const api=async(path,body)=>{const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(r.ok);return r.json();};
  const event=await api('events',{payload:{type:'controlled.test',secret:'must-not-leave',message:'สวัสดี'}});
  const approval=await api('prepare',{id:event.id,url});
  const result=await api('replay',{nonce:approval.nonce,confirm:'SEND TO STAGING'});
  assert.equal(result.outcome,'response_received');assert.equal(result.status,202);
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].body.secret,'[REDACTED]');assert.equal(f.requests[0].body.message,'สวัสดี');
  assert.equal(f.requests[0].headers['idempotency-key'],result.id);
  assert.equal(f.requests[0].headers['x-webhook-replay-attempt'],result.id);
  assert.equal(f.requests[0].headers.authorization,undefined);
  assert.equal((await api('events')).events[0].attempts[0].id,result.id);
  await assert.rejects(resolveTarget(url,[url],async()=>[{address:'127.0.0.1',family:4}]),/non-public/);
});
test('real TLS redirects, certificate checks, body cap, disconnect and timeout fail safely',async t=>{
  const f=await setup(t);
  assert.equal((await f.send('/redirect')).redirectBlocked,true);
  assert.equal(f.requests.length,1);
  await assert.rejects(f.send('/accepted',{},undefined,false),/self-signed|certificate/i);
  await assert.rejects(f.send(f.base.replace('localhost','127.0.0.1')+'/accepted'),/IP|Hostname|certificate/i);
  assert.equal(f.requests.length,1,'certificate failures must not deliver an HTTP request');
  await assert.rejects(f.send('/oversize'),/Response limit exceeded/);
  await assert.rejects(f.send('/disconnect'),/aborted|reset|closed/i);
  await assert.rejects(f.send('/timeout'),/Replay timeout/);
  assert.equal(f.requests.length,4,'no retry and no redirect follow');
});
