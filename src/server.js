import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { redact, digest, targetURL, resolveTarget, transmit, differences } from './core.js';

export function createLab({token, allowlist=[], send=transmit, resolve=resolveTarget, now=Date.now}={}) {
  if (!token || token.length<32) throw new Error('Admin token must have at least 32 characters');
  allowlist.forEach(url=>targetURL(url,allowlist));
  const events = new Map(), approvals = new Map();
  const ttl = 24*60*60*1000;
  let nextReplay = 0, windowStart=now(), requests=0;
  const auth = candidate => typeof candidate==='string' && Buffer.byteLength(candidate)===Buffer.byteLength(token) && timingSafeEqual(Buffer.from(candidate),Buffer.from(token));
  const sweep = () => {for(const [id,e] of events) if(now()-e.createdAt>=ttl) events.delete(id);for(const [id,a] of approvals) if(now()>a.expires) approvals.delete(id);};
  const timer=setInterval(sweep,30000);timer.unref();
  const server = http.createServer(async(req,res)=>{
    const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
    try {
      const host=(req.headers.host||'').split(':')[0];
      if(!['localhost','127.0.0.1'].includes(host)) return reply(403,{error:'Local Host header required'});
      if(req.headers.origin && ![`http://${req.headers.host}`].includes(req.headers.origin)) return reply(403,{error:'Cross-origin request blocked'});
      if(req.method==='GET' && req.url==='/') {
        res.writeHead(200,{'content-type':'text/html','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"});
        return res.end(readFileSync(new URL('./index.html',import.meta.url)));
      }
      if(req.method==='GET' && ['/app.js','/style.css'].includes(req.url)) {
        res.writeHead(200,{'content-type':req.url.endsWith('.js')?'text/javascript':'text/css','x-content-type-options':'nosniff'});
        return res.end(readFileSync(new URL('.'+req.url,import.meta.url)));
      }
      if(!auth((req.headers.authorization||'').replace(/^Bearer /,''))) return reply(401,{error:'Private inbox: valid bearer token required'});
      sweep();
      if(now()-windowStart>=60000){windowStart=now();requests=0;}
      if(++requests>120) return reply(429,{error:'120 requests/minute limit'});
      let input={};
      if(req.method==='POST') {
        if(!req.headers['content-type']?.startsWith('application/json')) return reply(415,{error:'JSON required'});
        let raw='';
        for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>65536){reply(413,{error:'64 KB request limit'});req.destroy();return;}}
        input=JSON.parse(raw||'{}');
      }
      if(req.method==='GET' && req.url==='/api/events') return reply(200,{events:[...events.values()].reverse(),allowlist,retentionHours:24,maxEvents:200});
      if(req.method==='POST' && req.url==='/api/events') {
        if(events.size>=200) return reply(409,{error:'Inbox full; delete an event or wait for expiry'});
        if(!input.payload || typeof input.payload!=='object') return reply(400,{error:'JSON object or array payload required'});
        const event={id:randomUUID(),createdAt:now(),payload:redact(input.payload),label:String(input.label||'Captured JSON').slice(0,80),attempts:[]};
        events.set(event.id,event);return reply(201,event);
      }
      const fixture=req.url?.match(/^\/api\/events\/([\w-]+)\/fixture$/);
      if(req.method==='GET' && fixture){const event=events.get(fixture[1]);return event?reply(200,{version:1,payload:event.payload,sha256:digest(event.payload)}):reply(404,{error:'Event expired or missing'});}
      if(req.method==='POST' && req.url==='/api/delete'){events.delete(input.id);return reply(200,{deleted:true});}
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
        if(!approval || input.confirm!=='SEND TO STAGING')return reply(400,{error:'Valid unexpired one-time approval and confirmation phrase required'});
        const event=events.get(approval.id);if(!event||digest(event.payload)!==approval.hash)return reply(409,{error:'Payload changed or expired'});
        if(now()<nextReplay)return reply(429,{error:'Wait 5 seconds between replay attempts'});
        approvals.delete(input.nonce);nextReplay=now()+5000;
        const attempt={id:randomUUID(),at:now(),url:approval.url,outcome:'validating'};
        event.attempts.push(attempt);if(event.attempts.length>20)event.attempts.shift();
        try {
          const target=await resolve(approval.url,allowlist);
          attempt.outcome='sending';
          Object.assign(attempt,await send(target,event.payload),{outcome:'response_received'});
        } catch(error){attempt.error=error.message;attempt.outcome=attempt.outcome==='sending'?'unknown_delivery':'blocked';}
        return reply(200,attempt);
      }
      reply(404,{error:'Not found'});
    } catch(error){reply(400,{error:error.message});}
  });
  server.on('close',()=>clearInterval(timer));
  server.requestTimeout=10000;server.headersTimeout=10000;
  return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const token=process.env.LAB_TOKEN || randomBytes(32).toString('hex');
  const allowlist=(process.env.STAGING_ALLOWLIST||'').split(',').filter(Boolean);
  const server=createLab({token,allowlist});
  server.requestTimeout=10000;server.headersTimeout=10000;
  const port=Number(process.env.PORT||4319),host=process.env.CONTAINER_MODE==='1'?'0.0.0.0':'127.0.0.1';
  server.listen(port,host,()=>console.log(`Webhook Replay Lab: http://127.0.0.1:${port}\nSession token: ${token}\nMemory-only storage. Replay destinations: ${allowlist.length}.`));
}
