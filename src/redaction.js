import {openSync,readSync,fstatSync,closeSync,constants} from 'node:fs';
import {redact} from './core.js';
// Restricted JSONPath: $.field, [index], [*]. No expressions, recursion or eval.
export function createRedactor(paths=[]) {
 if(!Array.isArray(paths)||paths.length>32)throw Error('Redaction requires at most 32 JSONPath rules');
 const compiled=paths.map(path=>{
  if(typeof path!=='string'||path.length>256||!path.startsWith('$')||path==='$')throw Error('Invalid redaction JSONPath');
  const parts=[];let rest=path.slice(1);
  while(rest){const m=/^(?:\.([A-Za-z_$][A-Za-z0-9_$]*)|\[(\d{1,6}|\*)\])/.exec(rest);if(!m)throw Error('Unsupported redaction JSONPath');parts.push(m[1]??(m[2]==='*'?null:Number(m[2])));rest=rest.slice(m[0].length);if(parts.length>32)throw Error('Redaction path too deep');}
  return parts;
 });
 return value=>{const clean=redact(value);
  function apply(node,parts,i){if(!node||typeof node!=='object')return;const part=parts[i];if(Array.isArray(node)&&typeof part==='string')return;if(!Array.isArray(node)&&typeof part==='number')return;const keys=part===null?(Array.isArray(node)?Object.keys(node):[]):[part];for(const key of keys){if(!Object.hasOwn(node,key))continue;if(i===parts.length-1)Object.defineProperty(node,key,{value:'[REDACTED]',enumerable:true,writable:true,configurable:true});else apply(node[key],parts,i+1);}}
  for(const parts of compiled)apply(clean,parts,0);return clean;
 };
}

export function readRedactionPaths(path){if(!path)return [];let fd;try{fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);const st=fstatSync(fd);if(!st.isFile()||st.size>16384)throw Error();const b=Buffer.alloc(16385);let n=0;while(n<b.length){const read=readSync(fd,b,n,b.length-n,null);if(!read)break;n+=read;}if(n>16384)throw Error();const paths=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,n)));createRedactor(paths);return paths;}catch{throw Error('Redaction file must contain valid supported rules in a regular file up to 16 KB');}finally{if(fd!==undefined)closeSync(fd);}}
