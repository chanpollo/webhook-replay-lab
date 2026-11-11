import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.js';
import { redact, digest, targetURL, resolveTarget, transmit, differences } from './core.js';

function boundedPayload(value) {
  const payload=redact(value);
  if(Buffer.byteLength(JSON.stringify(payload))>65536)throw new Error('Sanitized payload exceeds the 64 KB storage limit');
  return payload;
}
// Validate an authenticated snapshot before constructing maps or recovering attempts.
// This is a compatibility gate for restoration, not a redaction migration.
function validateState(state) {
  const ids=new Set(),receiptIds=new Set();
  for(const event of state.events) {
    if(!event || typeof event.id!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(event.id) || ids.has(event.id) || !Number.isSafeInteger(event.createdAt) || event.createdAt<0 || typeof event.label!=='string' || event.label.length>80 || !event.payload || typeof event.payload!=='object' || !Array.isArray(event.attempts) || event.attempts.length>20)throw new Error('Invalid persisted event');
    ids.add(event.id);
    // Accept existing v1 redacted payloads, including those larger than the new capture cap.
    redact(event.payload); // Enforce the nesting bound without changing stored content/hash.
    for(const attempt of event.attempts) {
      if(!attempt || !['validating','sending','blocked','unknown_delivery','response_received'].includes(attempt.outcome))throw new Error('Invalid persisted replay attempt');
    }
  }
  for(const receipt of state.receipts) {
    if(!Array.isArray(receipt) || receipt.length!==2 || typeof receipt[0]!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(receipt[0]) || receiptIds.has(receipt[0]) || !Number.isSafeInteger(receipt[1]) || receipt[1]<0)throw new Error('Invalid persisted ingress receipt');
    receiptIds.add(receipt[0]);
  }
}

// Failed startup releases its own lock, never another writer's lock.
export function createLab(options={}) {
  try { return buildLab(options); }
  catch(error) { try { options.store?.close(); } catch {} throw error; }
}
function buildLab({token, allowlist=[], send=transmit, resolve=resolveTarget, now=Date.now, store=null, ingressKey=null}={}) {
  if (!token || token.length<32) throw new Error('Admin token must have at least 32 characters');
  allowlist.forEach(url=>targetURL(url,allowlist));
  if (ingressKey && (!store || !/^[a-f0-9]{64}$/i.test(ingressKey))) throw new Error('Ingress requires persistent storage and a 32-byte hex signing key');
  const initial=store?store.load():null;
  if(initial!==null && (typeof initial!=='object' || initial.version!==1 || !Array.isArray(initial.events) || initial.events.length>200 || !Array.isArray(initial.receipts) || initial.receipts.length>2000)) throw new Error('Invalid persisted state');
  if(initial)validateState(initial);
  const events = new Map((initial?.events||[]).map(e=>[e.id,e])), approvals = new Map(), receipts=new Map(initial?.receipts||[]);
  let storageHealthy=true;
  const persist=()=>{try{store?.save({version:1,events:[...events.values()],receipts:[...receipts]});}catch{storageHealthy=false;throw new Error('Storage unavailable; stop and restore before continuing');}};
  for(const event of events.values()) for(const attempt of event.attempts) if(['validating','sending'].includes(attempt.outcome)) {attempt.outcome=attempt.outcome==='sending'?'unknown_delivery':'blocked';attempt.error='Process interrupted; inspect destination before retry';}
  if(initial)persist();
  const ttl = 24*60*60*1000;
  let nextReplay = 0, windowStart=now(), requests=0,ingressRequests=0;
  const auth = candidate => typeof candidate==='string' && Buffer.byteLength(candidate)===Buffer.byteLength(token) && timingSafeEqual(Buffer.from(candidate),Buffer.from(token));
  const sweep = () => {let changed=false;for(const [id,e] of events) if(now()-e.createdAt>=ttl&&!e.attempts.some(a=>['validating','sending'].includes(a.outcome))){events.delete(id);changed=true;}for(const [id,a] of approvals) if(now()>=a.expires) approvals.delete(id);for(const [id,at] of receipts)if(now()-at>=600000){receipts.delete(id);changed=true;}if(changed)persist();};
  const timer=setInterval(()=>{if(storageHealthy)try{sweep();}catch{}},30000);timer.unref();
  let budgetStart=now(),budget=0;
  const server = http.createServer(async(req,res)=>{
    const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
    try {
      if(now()-budgetStart>=60000){budgetStart=now();budget=0;}
      const authorized=auth((req.headers.authorization||'').replace(/^Bearer /,''));
      const privateStatic=req.method==='GET'&&['/','/app.js','/analytics.js','/style.css','/healthz'].includes(req.url);
      if(!authorized&&!privateStatic&&++budget>600)return reply(429,{error:'Public request limit exceeded'});
      if(!storageHealthy)return reply(503,{error:'Storage unavailable; operator intervention required'});
      const host=(req.headers.host||'').split(':')[0];
      if(!['localhost','127.0.0.1'].includes(host)) return reply(403,{error:'Local Host header required'});
      if(req.headers.origin && ![`http://${req.headers.host}`].includes(req.headers.origin)) return reply(403,{error:'Cross-origin request blocked'});
      if(req.method==='GET' && req.url==='/healthz')return reply(200,{status:'ok'});
      if(req.method==='GET' && req.url==='/') {
        res.writeHead(200,{'content-type':'text/html','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});
        return res.end(readFileSync(new URL('./index.html',import.meta.url)));
      }
      if(req.method==='GET' && ['/app.js','/analytics.js','/style.css'].includes(req.url)) {
        res.writeHead(200,{'content-type':req.url.endsWith('.js')?'text/javascript':'text/css','x-content-type-options':'nosniff'});
        return res.end(readFileSync(new URL('.'+req.url,import.meta.url)));
      }
      const ingress=req.method==='POST' && req.url==='/ingress';
      if(ingress && !ingressKey)return reply(404,{error:'Ingress disabled'});
      if(!ingress && !authorized) return reply(401,{error:'Private inbox: valid bearer token required'});
      sweep();
      if(now()-windowStart>=60000){windowStart=now();requests=0;ingressRequests=0;}
      if(!ingress&&++requests>120) return reply(429,{error:'120 requests/minute limit'});
      let input={},rawBody;
      if(ingress && Number(req.headers['content-length'])>65536)return reply(413,{error:'64 KB request limit'});
      if(req.method==='POST') {
        if(!req.headers['content-type']?.startsWith('application/json')) return reply(415,{error:'JSON required'});
        const chunks=[];let bytes=0;
        const bodyTimer=setTimeout(()=>req.destroy(),5000);
        try{for await(const chunk of req){bytes+=chunk.length;if(bytes>65536){reply(413,{error:'64 KB request limit'});req.destroy();return;}chunks.push(chunk);}}finally{clearTimeout(bodyTimer);}
        rawBody=Buffer.concat(chunks);
        const raw=new TextDecoder('utf-8',{fatal:true}).decode(rawBody);
        input=JSON.parse(raw||'{}');
        if(!input || typeof input!=='object')return reply(400,{error:'JSON object or array required'});
      }
      if(ingress){
        const timestamp=req.headers['x-lab-timestamp'],id=req.headers['x-lab-event-id'],signature=req.headers['x-lab-signature'];
        if(typeof timestamp!=='string'||!/^\d{10}$/.test(timestamp)||Math.abs(now()-Number(timestamp)*1000)>300000||typeof id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(id)||typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature))return reply(401,{error:'Valid timestamp, event ID and signature required'});
        const expected=createHmac('sha256',Buffer.from(ingressKey,'hex')).update(timestamp+'.'+id+'.').update(rawBody).digest('hex');
        if(!timingSafeEqual(Buffer.from(signature.slice(7)),Buffer.from(expected)))return reply(401,{error:'Invalid signature'});
        if(++ingressRequests>120)return reply(429,{error:'Signed ingress request limit exceeded'});
        if(receipts.has(id))return reply(200,{duplicate:true});
        if(events.size>=200||receipts.size>=2000)return reply(409,{error:'Inbox or receipt capacity reached'});
        const event={id:randomUUID(),createdAt:now(),payload:boundedPayload(input),label:'Signed ingress',attempts:[]};
        events.set(event.id,event);receipts.set(id,now());persist();return reply(201,{id:event.id});
      }
      if(req.method==='GET' && req.url==='/api/events') return reply(200,{events:[...events.values()].reverse(),allowlist,retentionHours:24,maxEvents:200,maxAttemptsPerEvent:20,serverTime:now(),persistent:!!store,ingressEnabled:!!ingressKey});
      if(req.method==='POST' && req.url==='/api/events') {
        if(events.size>=200) return reply(409,{error:'Inbox full; delete an event or wait for expiry'});
        if(!input.payload || typeof input.payload!=='object') return reply(400,{error:'JSON object or array payload required'});
        const event={id:randomUUID(),createdAt:now(),payload:boundedPayload(input.payload),label:redact(String(input.label||'Captured JSON')).slice(0,80),attempts:[]};
        events.set(event.id,event);persist();return reply(201,event);
      }
      const fixture=req.url?.match(/^\/api\/events\/([\w-]+)\/fixture$/);
      if(req.method==='GET' && fixture){const event=events.get(fixture[1]);return event?reply(200,{version:1,payload:event.payload,sha256:digest(event.payload)}):reply(404,{error:'Event expired or missing'});}
      if(req.method==='POST' && req.url==='/api/delete'){if(events.get(input.id)?.attempts.some(a=>['validating','sending'].includes(a.outcome)))return reply(409,{error:'Wait for the active replay to settle before deletion'});events.delete(input.id);persist();return reply(200,{deleted:true});}
      if(req.method==='POST' && req.url==='/api/compare') {
        const a=events.get(input.a),b=events.get(input.b);
        if(!a||!b)return reply(404,{error:'Select two existing events'});
        return reply(200,{differences:differences(a.payload,b.payload),limit:200});
      }
      if(req.method==='POST' && req.url==='/api/prepare') {
        const event=events.get(input.id);if(!event)return reply(404,{error:'Event missing'});
        targetURL(input.url,allowlist);
        if(approvals.size>=100)return reply(429,{error:'Too many pending confirmations'});
        const nonce=randomUUID();const approval={id:event.id,url:input.url,hash:digest(event.payload),expires:now()+60000};
        approvals.set(nonce,approval);
        return reply(200,{nonce,...approval,warning:'One POST with redacted JSON. This can cause side effects. Confirm you own this staging endpoint. No automatic retry. Original signatures and credentials are not sent.'});
      }
      if(req.method==='POST' && req.url==='/api/replay') {
        const approval=approvals.get(input.nonce);
        if(!approval || now()>=approval.expires || input.confirm!=='SEND TO STAGING')return reply(400,{error:'Valid unexpired one-time approval and confirmation phrase required'});
        const event=events.get(approval.id);if(!event||digest(event.payload)!==approval.hash)return reply(409,{error:'Payload changed or expired'});
        if(now()<nextReplay)return reply(429,{error:'Wait 5 seconds between replay attempts'});
        approvals.delete(input.nonce);nextReplay=now()+5000;
        const attempt={id:randomUUID(),at:now(),url:approval.url,outcome:'validating'};
        event.attempts.push(attempt);if(event.attempts.length>20)event.attempts.shift();
        persist();
        try {
          const target=await resolve(approval.url,allowlist);
          if(events.get(event.id)!==event||now()-event.createdAt>=ttl)throw new Error('Event expired or removed before transmission');
          attempt.outcome='sending';persist();
          Object.assign(attempt,await send(target,event.payload,{attemptId:attempt.id}),{outcome:'response_received'});
        } catch(error){attempt.error=String(error.message).slice(0,1024);attempt.outcome=attempt.outcome==='sending'?'unknown_delivery':'blocked';}
        persist();return reply(200,attempt);
      }
      reply(404,{error:'Not found'});
    } catch(error){if(!res.headersSent&&!res.destroyed)reply(storageHealthy?400:503,{error:storageHealthy?error.message:'Storage unavailable; operator intervention required'});}
  });
  server.on('close',()=>{clearInterval(timer);store?.close();});
  server.requestTimeout=10000;server.headersTimeout=10000;server.maxConnections=128;
  return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const secret=name=>process.env[name+'_FILE']?readFileSync(process.env[name+'_FILE'],'utf8').trim():process.env[name];
  const configuredToken=secret('LAB_TOKEN');
  const token=configuredToken || randomBytes(32).toString('hex');
  const allowlist=(process.env.STAGING_ALLOWLIST||'').split(',').filter(Boolean);
  const store=process.env.LAB_DATA_PATH?createStore({path:process.env.LAB_DATA_PATH,key:secret('LAB_STORAGE_KEY')}):null;
  const server=createLab({token,allowlist,store,ingressKey:secret('LAB_INGRESS_KEY')});
  server.requestTimeout=10000;server.headersTimeout=10000;
  const port=Number(process.env.PORT||4319),host=process.env.CONTAINER_MODE==='1'?'0.0.0.0':'127.0.0.1';
  for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),10000).unref();});
  server.listen(port,host,()=>console.log(`Webhook Replay Lab: http://127.0.0.1:${port}${configuredToken?'':'\nSession token: '+token}\n${store?'Encrypted persistent':'Memory-only'} storage. Replay destinations: ${allowlist.length}.`));
}
