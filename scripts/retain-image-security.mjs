import fs from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export function assertPublicImageEvidenceSafe(scan,inspect){
 const image=Array.isArray(inspect)&&inspect.length===1&&inspect[0];
 if(!image||!/^sha256:[a-f0-9]{64}$/.test(image.Id)||image.Config?.User!=='node'||image.Os!=='linux'||image.Architecture!=='amd64'||!Array.isArray(image.Config.Env)||!image.Config.Env.every(value=>typeof value==='string'&&/^(PATH|NODE_VERSION|YARN_VERSION)=/.test(value))||image.Config.Env.filter(value=>value.startsWith('NODE_VERSION=')).length!==1||scan?.SchemaVersion!==2||scan.ArtifactType!=='container_image'||scan.Metadata?.ImageID!==image.Id||!Array.isArray(scan.Results)||!scan.Results.every(result=>result&&typeof result==='object'&&(result.Secrets===undefined||(Array.isArray(result.Secrets)&&result.Secrets.length===0))))throw Error('Private image findings withheld');
}
function bounded(path){const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);try{const st=fs.fstatSync(fd);if(!st.isFile()||st.nlink!==1||st.size>8*1024*1024)throw Error();const bytes=Buffer.alloc(st.size+1);let length=0;while(length<bytes.length){const count=fs.readSync(fd,bytes,length,bytes.length-length,null);if(!count)break;length+=count;}if(length!==st.size)throw Error();return bytes.subarray(0,length);}finally{fs.closeSync(fd);}}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==5)throw Error();const scan=bounded(process.argv[2]),inspect=bounded(process.argv[3]);assertPublicImageEvidenceSafe(JSON.parse(scan),JSON.parse(inspect));for(const [name,bytes] of [['trivy.json',scan],['image-inspect.json',inspect]])fs.writeFileSync(join(process.argv[4],name),bytes,{flag:'wx',mode:0o600});console.log('Image evidence retained after secret/config checks.');}
 catch{try{if(process.argv.length===5)fs.writeFileSync(join(process.argv[4],'withheld.json'),'{"accepted":false,"reason":"private-image-findings-withheld"}\n',{flag:'wx',mode:0o600});}catch{}console.error('Image security evidence withheld; inspect private runner findings.');process.exitCode=1;}
}
