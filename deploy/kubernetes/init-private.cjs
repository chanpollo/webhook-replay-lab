// Mounted from ConfigMap. Only fixed kubelet-projected Secret paths are read.
const fs=require('node:fs');
function privateDirectory(path){try{fs.mkdirSync(path,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}const s=fs.lstatSync(path);if(!s.isDirectory()||s.uid!==process.getuid()||(s.mode&0o077)!==0)throw Error('Private directory ownership/mode mismatch; inspect volume, do not chmod live data automatically');}
function copySecret(name,valid){let fd;try{fd=fs.openSync('/secret-source/'+name,fs.constants.O_RDONLY|fs.constants.O_NONBLOCK);const s=fs.fstatSync(fd);if(!s.isFile()||s.size>4096)throw Error();const b=Buffer.alloc(4097);let n=0;while(n<b.length){const c=fs.readSync(fd,b,n,b.length-n,null);if(!c)break;n+=c;}if(n>4096)throw Error();const value=new TextDecoder('utf-8',{fatal:true}).decode(b.subarray(0,n)).trim();if(!valid(value))throw Error();const target='/private-runtime/private/'+name;try{const old=fs.lstatSync(target);if(!old.isFile()||old.nlink!==1||old.uid!==process.getuid()||(old.mode&0o077)!==0||old.size>4096||fs.readFileSync(target,'utf8')!==value)throw Error();}catch(e){if(e.code!=='ENOENT')throw e;fs.writeFileSync(target,value,{mode:0o600,flag:'wx'});}}catch{throw Error('Invalid or unreadable required Secret input');}finally{if(fd!==undefined)fs.closeSync(fd);}}
privateDirectory('/data/private');privateDirectory('/private-runtime/private');
copySecret('admin-token',x=>/^[\x21-\x7e]{32,256}$/.test(x));
copySecret('storage-key',x=>/^[a-fA-F0-9]{64}$/.test(x));
console.log('Private runtime files and encrypted-store directory prepared');
