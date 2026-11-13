import {openSync,fstatSync,readSync,closeSync,constants} from 'node:fs';

// Only reads operator-designated files; never logs values or filesystem paths.
export function readSecret(name,{env=process.env,emptyIsUnset=false}={}) {
  if(typeof name!=='string'||!/^LAB_[A-Z_]+$/.test(name))throw Error('Invalid secret configuration name');
  const direct=env[name],path=env[name+'_FILE'];
  if(direct!==undefined&&path!==undefined)throw Error(`Configure only one ${name} secret source`);
  if(direct===undefined&&path===undefined)return undefined;
  if(path===undefined){
    if(emptyIsUnset&&direct==='')return undefined;
    if(typeof direct!=='string'||direct.length===0||Buffer.byteLength(direct)>4096)throw Error(`Invalid ${name} secret value`);
    return direct;
  }
  let fd;
  try {
    if(typeof path!=='string'||!path)throw Error();
    fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
    const st=fstatSync(fd);
    if(!st.isFile()||st.nlink!==1||(st.mode&0o077)!==0||(process.getuid&&st.uid!==process.getuid())||st.size>4096)throw Error();
    const bytes=Buffer.alloc(4097);let size=0;
    while(size<bytes.length){const n=readSync(fd,bytes,size,bytes.length-size,null);if(!n)break;size+=n;}
    if(size>4096)throw Error();
    const value=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,size)).trim();
    if(!value)throw Error();
    return value;
  } catch {throw Error(`${name} secret file must be nonempty, private, owned, regular, non-linked and at most 4 KB`);}
  finally {if(fd!==undefined)closeSync(fd);}
}
