import { lookup } from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';
import { randomUUID, createHash } from 'node:crypto';

const sensitive = /password|passwd|passphrase|credential|secret|token|authorization|cookie|api.?key|signature|email|phone|address|card|ssn/i;
const sensitiveWords = new Set(['cvv','cvc','pin','otp','totp','jwt','iban','pan','pwd','mnemonic']);
const sensitiveNames = ['privatekey','sessionid','accountnumber','routingnumber','recoverycode','recoverykey','recoveryseed','seedphrase','backupcode','accesskey','signingkey','encryptionkey','securityanswer'];
function sensitiveKey(key) {
  const words=key.replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/([a-z0-9])([A-Z])/g,'$1 $2').toLowerCase().split(/[^a-z0-9]+/);
  const compact=words.join('');
  return sensitive.test(key) || words.some(word=>sensitiveWords.has(word)) || sensitiveNames.some(name=>compact.includes(name));
}
export function redact(value, depth = 0) {
  if (depth > 32) throw new Error('Payload nesting limit exceeded');
  if (Array.isArray(value)) return value.map(v => redact(v, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, sensitiveKey(k) ? '[REDACTED]' : redact(v, depth + 1)]));
  // Conservative scrubbing, not a guarantee against arbitrary PII in free text.
  return typeof value === 'string' ? value.replace(/[A-Za-z0-9_.+@-]+/g, token => {
    if(!token.includes('@'))return token;
    const parts=token.split('@');
    for(let i=1;i<parts.length;i++) {
      let end=parts[i].length;while(end>0 && parts[i][end-1]==='.')end--;
      const domain=parts[i].slice(0,end);
      if(parts[i-1] && /^[\w.-]+\.[A-Za-z]{2,}$/.test(domain))return '[EMAIL]';
    }
    return token;
  }).replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]') : value;
}
export const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function publicIPv4(ip) {
  if (isIP(ip) !== 4) return false;
  const [a,b,c] = ip.split('.').map(Number);
  return !(a===0 || a===10 || a===127 || a>=224 || (a===100 && b>=64 && b<=127) || (a===169 && b===254) || (a===172 && b>=16 && b<=31) || (a===192 && (b===168 || b===0 || (b===88 && c===99))) || (a===198 && (b===18 || b===19 || (b===51 && c===100))) || (a===203 && b===0 && c===113));
}
// Conservative ordinary global-unicast subset, not all globally reachable IPv6.
// IANA special-purpose registry reviewed 2026-11-12; deny protocol/transition
// assignments including their globally reachable exceptions. Never accept zones
// or embedded IPv4 text. Keep this snapshot maintained as allocations change.
export function publicIPv6(ip) {
  if (typeof ip !== 'string' || ip.includes('%') || ip.includes('.') || isIP(ip) !== 6) return false;
  const halves=ip.toLowerCase().split('::');
  const left=halves[0]?halves[0].split(':'):[];
  const right=halves.length===2 && halves[1]?halves[1].split(':'):[];
  const words=(halves.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left).map(x=>parseInt(x,16));
  const [a,b,c]=words;
  if (a<0x2000 || a>0x3fff) return false;
  if (a===0x2001 && (b<0x0200 || b===0x0db8)) return false;
  if (a===0x2002 || (a===0x3fff && b<0x1000)) return false;
  if (a===0x2620 && b===0x004f && c===0x8000) return false;
  return true;
}
export function targetURL(raw, allowlist) {
  if (typeof raw !== 'string' || raw.length > 2048) throw new Error('Invalid destination');
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.port && u.port !== '443' || u.username || u.password || u.hash || u.search || u.hostname.startsWith('[') || isIP(u.hostname)) throw new Error('HTTPS hostname, port 443, no credentials/query/fragment required');
  // Exact URL only. Staging ownership is an operator assertion, never inferred from a name.
  if (!allowlist.includes(u.href)) throw new Error('Destination not in operator-confirmed staging allowlist');
  return u;
}
export async function resolveTarget(raw, allowlist, resolver = lookup, timeoutMs = 2000) {
  const url = targetURL(raw, allowlist);
  let timer;
  const answers = await Promise.race([resolver(url.hostname, { all:true, verbatim:true }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS resolution deadline exceeded')), timeoutMs); })]).finally(() => clearTimeout(timer));
  if (!answers.length || answers.some(a => !(publicIPv4(a.address)||publicIPv6(a.address)) || (a.family!==undefined && a.family!==isIP(a.address)))) throw new Error('Destination DNS includes a non-public or unsupported address');
  // Prefer validated IPv4 for dual-stack hosts, but never discard unsafe answers.
  const selected=answers.find(a=>isIP(a.address)===4)||answers[0];
  return { url, address:selected.address, family:isIP(selected.address) };
}
export async function transmit(target, body, {attemptId=randomUUID()} = {}) {
  if (typeof attemptId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(attemptId)) throw new Error('Invalid replay attempt ID');
  return new Promise((resolve,reject) => {
    const data = JSON.stringify(body);
    const started = Date.now();
    const req = https.request(target.url, {
      method:'POST', agent:false, family:isIP(target.address),
      lookup:(_host, options, cb) => options.all ? cb(null,[{address:target.address,family:isIP(target.address)}]) : cb(null,target.address,isIP(target.address)),
      headers:{'content-type':'application/json','content-length':Buffer.byteLength(data),'x-webhook-replay-lab':'staging-replay','idempotency-key':attemptId,'x-webhook-replay-attempt':attemptId}
    }, res => {
      // Never follow redirects or retain response bodies/headers that may contain secrets.
      res.resume();
      res.on('end', () => resolve({status:res.statusCode,durationMs:Date.now()-started,redirectBlocked:res.statusCode>=300 && res.statusCode<400}));
      res.on('error',reject);
      let size = 0;
      res.on('data',chunk=>{size+=chunk.length;if(size>65536) req.destroy(new Error('Response limit exceeded'));});
    });
    const timer = setTimeout(()=>req.destroy(new Error('Replay timeout; delivery outcome may be unknown. Do not retry blindly.')),5000);
    req.on('close',()=>clearTimeout(timer));
    req.on('error',reject);
    req.end(data);
  });
}
export function differences(a,b,path='$',out=[]) {
  if (out.length>=200) return out;
  if (JSON.stringify(a)===JSON.stringify(b)) return out;
  if (a && b && typeof a==='object' && typeof b==='object' && Array.isArray(a)===Array.isArray(b)) {
    for(const key of new Set([...Object.keys(a),...Object.keys(b)])) differences(Object.hasOwn(a,key)?a[key]:undefined,Object.hasOwn(b,key)?b[key]:undefined,`${path}.${key}`,out);
  } else out.push({path,before:a??null,after:b??null,...(a===undefined?{beforeMissing:true}:{}),...(b===undefined?{afterMissing:true}:{})});
  return out;
}
