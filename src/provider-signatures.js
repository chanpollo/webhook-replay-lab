import {createHmac,timingSafeEqual} from 'node:crypto';
import {openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';

const invalid=()=>new Error('Invalid Stripe webhook signature');
// Standalone inbound authentication, not event parsing, authorization or replay signing.
export function createStripeVerifier({secret,now=Date.now}={}) {
  if(typeof secret!=='string'||!/^whsec_[\x21-\x7e]{16,256}$/.test(secret)||typeof now!=='function')throw new Error('Invalid Stripe webhook verifier configuration');
  return function verify({rawBody,signatureHeader,headerCount}={}) {
    if(!Buffer.isBuffer(rawBody)||rawBody.length===0||rawBody.length>65536)throw invalid();
    const {timestampText,timestamp,signatures}=parseHeader({signatureHeader,headerCount,nowMs:now()});
    // Use the complete signing secret as UTF-8 key. Never decode the whsec_ suffix.
    // Authenticate the captured bytes before any JSON parsing or redaction.
    const expected=createHmac('sha256',Buffer.from(secret,'utf8')).update(timestampText+'.','ascii').update(rawBody).digest();
    let matched=0;
    for(const signature of signatures)matched|=Number(timingSafeEqual(expected,signature));
    if(!matched)throw invalid();
    return Object.freeze({provider:'stripe',timestamp});
  };
}

function parseHeader({signatureHeader,headerCount,nowMs}) {
  if(headerCount!==1||typeof signatureHeader!=='string'||signatureHeader.length===0||signatureHeader.length>4096||/[\r\n\x00-\x1f\x7f]/.test(signatureHeader))throw invalid();
    const fields=signatureHeader.split(',');
    if(fields.length>16)throw invalid();
    let timestampText=null;const signatures=[];
    for(const field of fields) {
      const pair=field.trim().match(/^(t|v[0-9]+)=([^=\s,]+)$/);
      if(!pair)throw invalid();
      if(pair[1]==='t') {
        if(timestampText!==null||!/^(0|[1-9][0-9]{0,12})$/.test(pair[2]))throw invalid();
        timestampText=pair[2];
      } else if(pair[1]==='v1') {
        if(!/^[a-f0-9]{64}$/i.test(pair[2])||signatures.length>=8)throw invalid();
        signatures.push(Buffer.from(pair[2],'hex'));
      } else if(!/^[a-f0-9]{1,256}$/i.test(pair[2]))throw invalid();
    }
    if(timestampText===null||!signatures.length)throw invalid();
    const timestamp=Number(timestampText),receivedAt=nowMs;
    if(!Number.isSafeInteger(timestamp)||!Number.isSafeInteger(receivedAt)||receivedAt<0||Math.abs(Math.floor(receivedAt/1000)-timestamp)>=300)throw invalid();
  return {timestampText,timestamp,signatures};
}
export function validateStripeSignatureHeader({signatureHeader,headerCount,nowMs=Date.now()}={}) {
  const {timestamp}=parseHeader({signatureHeader,headerCount,nowMs});
  return {provider:'stripe',timestamp};
}

export function readStripeSecret(env=process.env) {
  const direct=env.LAB_STRIPE_SECRET,path=env.LAB_STRIPE_SECRET_FILE;
  if(direct===undefined&&path===undefined)return null;
  if(direct!==undefined&&path!==undefined)throw Error('Configure only one Stripe signing secret source');
  let value=direct,fd;
  if(path!==undefined){try{
    if(typeof path!=='string'||!path)throw Error();
    fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const stat=fstatSync(fd);
    if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o077)!==0||(process.getuid&&stat.uid!==process.getuid())||stat.size>4096)throw Error();
    const bytes=Buffer.alloc(4097);let total=0;while(total<bytes.length){const n=readSync(fd,bytes,total,bytes.length-total,null);if(!n)break;total+=n;}if(total>4096)throw Error();
    value=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,total)).trim();
  }catch{throw Error('Stripe secret file must be private, owned, regular, non-linked and at most 4 KB');}finally{if(fd!==undefined)closeSync(fd);}}
  createStripeVerifier({secret:value});return value;
}
