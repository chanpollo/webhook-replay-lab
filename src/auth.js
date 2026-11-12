import {createHash,timingSafeEqual} from 'node:crypto';
import {openSync,readSync,fstatSync,closeSync,constants} from 'node:fs';

const tokenValid=value=>typeof value==='string'&&/^[\x21-\x7e]{32,256}$/.test(value);
const hash=value=>createHash('sha256').update(value).digest();
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);

// A role applies to this entire inbox, never to a tenant or event ownership group.
export function createCredentialPolicy({adminToken,credentials=[]}={}) {
  if(!tokenValid(adminToken))throw Error('Admin token must be 32–256 printable non-space ASCII characters');
  if(!Array.isArray(credentials)||credentials.length>16)throw Error('Scoped credentials must be an array of at most 16 entries');
  const entries=[{id:'admin',scope:'admin',digest:hash(adminToken)}],ids=new Set(['admin']),tokens=new Set([adminToken]);
  for(const credential of credentials) {
    if(!plain(credential)||Object.keys(credential).sort().join(',')!=='id,scope,token'||typeof credential.id!=='string'||!/^[a-zA-Z0-9_-]{1,40}$/.test(credential.id)||ids.has(credential.id)||!['capture','read'].includes(credential.scope)||!tokenValid(credential.token)||tokens.has(credential.token))throw Error('Invalid or duplicate scoped credential configuration');
    ids.add(credential.id);tokens.add(credential.token);entries.push({id:credential.id,scope:credential.scope,digest:hash(credential.token)});
  }
  return Object.freeze({
    authenticate(header) {
      if(typeof header!=='string'||!header.startsWith('Bearer ')||!tokenValid(header.slice(7)))return null;
      const digest=hash(header.slice(7));let result=null;
      // Compare every entry; no first-match timing signal or raw tokens retained.
      for(const entry of entries)if(timingSafeEqual(digest,entry.digest))result=Object.freeze({id:entry.id,scope:entry.scope});
      return result;
    },
    allows(principal,method,path) {
      if(!principal)return false;
      if(principal.scope==='admin')return true;
      if(principal.scope==='capture')return method==='POST'&&path==='/api/events';
      if(principal.scope==='read')return (method==='GET'&&(path==='/api/events'||/^\/api\/events\/[A-Za-z0-9_-]+\/fixture$/.test(path)))||(method==='POST'&&['/api/compare','/api/collections/export'].includes(path));
      return false;
    }
  });
}

export function readScopedCredentials(path) {
  if(!path)return [];
  let fd;
  try {
    // No symlink following, nonregular sources, group/world access or huge files.
    fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    const stat=fstatSync(fd);
    if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size>16384)throw Error();
    const buffer=Buffer.alloc(16385);let total=0;
    while(total<buffer.length){const n=readSync(fd,buffer,total,buffer.length-total,null);if(!n)break;total+=n;}
    if(total>16384)throw Error();
    const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,total)));
    if(!Array.isArray(parsed))throw Error();
    return parsed;
  } catch {throw Error('Scoped credential file must be valid JSON, regular, private (0600 or stricter), and at most 16 KB');}
  finally {if(fd!==undefined)closeSync(fd);}
}
