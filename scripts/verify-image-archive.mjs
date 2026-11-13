import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';

const must=(ok,message)=>{if(!ok)throw Error(message);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
const maxBytes=1024*1024*1024,maxMetadata=2*1024*1024;
function smallJson(path){const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);try{const st=fs.fstatSync(fd);must(st.isFile()&&st.nlink===1&&st.size<=8*1024*1024,'Bounded regular metadata required');return JSON.parse(fs.readFileSync(fd));}finally{fs.closeSync(fd);}}

// No extraction, Docker socket, external executable or network. Hash every member.
export async function verifyImageArchive(path,{imageId,tag,inspect,archiveSha256}, {maxExpandedLayerBytes=maxBytes}={}) {
 must(digest(imageId)&&typeof tag==='string'&&Array.isArray(inspect)&&inspect.length===1&&inspect[0].Id===imageId,'Expected Docker identity required');
 must((archiveSha256===undefined||/^[a-f0-9]{64}$/.test(archiveSha256))&&Number.isSafeInteger(maxExpandedLayerBytes)&&maxExpandedLayerBytes>0&&maxExpandedLayerBytes<=maxBytes,'Invalid archive hash or narrowed limit');
 const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
 let source,decoded;
 try{
  const st=fs.fstatSync(fd);must(st.isFile()&&st.nlink===1&&st.size>0&&st.size<=maxBytes,'Bounded regular archive required');
  const compressedHash=createHash('sha256');let compressedBytes=0,expandedLayerBytes=0;
  source=fs.createReadStream(null,{fd,autoClose:true});decoded=createGunzip();source.on('data',bytes=>{compressedBytes+=bytes.length;compressedHash.update(bytes);});source.on('error',error=>decoded.destroy(error));source.pipe(decoded);
  const iterator=decoded[Symbol.asyncIterator]();let chunk=Buffer.alloc(0),offset=0,total=0;
  async function read(n,eof=false){const pieces=[];let length=0;while(length<n){if(offset===chunk.length){const next=await iterator.next();if(next.done){must(eof&&length===0,'Truncated archive');return null;}chunk=next.value;offset=0;total+=chunk.length;must(total<=maxBytes,'Expanded archive exceeds bound');}const count=Math.min(n-length,chunk.length-offset);pieces.push(chunk.subarray(offset,offset+count));offset+=count;length+=count;}return Buffer.concat(pieces,n);}
  const entries=new Map();let zeros=0;
  while(true){const header=await read(512,true);if(!header)break;if(header.every(byte=>byte===0)){zeros++;continue;}must(zeros===0,'Nonzero data after tar footer');
   let checksum=0;for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:header[i];
   const octal=(start,length)=>{const value=header.subarray(start,start+length).toString('ascii').replace(/\0.*$/s,'').trim();must(/^[0-7]+$/.test(value),'Invalid tar numeric field');return Number.parseInt(value,8);};
   must(checksum===octal(148,8),'Tar header checksum mismatch');
   const field=(start,length)=>header.subarray(start,start+length).toString('utf8').replace(/\0.*$/s,'');
   const prefix=field(345,155),name=(prefix?prefix+'/':'')+field(0,100),type=header[156],size=octal(124,12);
   must(name&&!name.startsWith('/')&&!name.split('/').some(part=>part==='..'||part==='.')&&!name.includes('\\')&&!entries.has(name)&&entries.size<512,'Unsafe or duplicate tar member');
   must((type===0||type===48||type===53)&&Number.isSafeInteger(size)&&size>=0&&size<=maxBytes&&(type!==53||size===0),'Unsupported tar member');
   must(type===53||/^(manifest\.json|index\.json|oci-layout|repositories|blobs\/sha256\/[a-f0-9]{64}|[a-f0-9]{64}\.json|[a-f0-9]{64}\/(VERSION|json|layer\.tar))$/.test(name),'Unexpected archive member');
   const hash=createHash('sha256'),pieces=[];let left=size,inflate,inflateDone,expandedHash,compression='none';
   try{
    while(left){const bytes=await read(Math.min(left,65536));
     if(left===size&&bytes[0]===31&&bytes[1]===139){compression='gzip';inflate=createGunzip();expandedHash=createHash('sha256');inflateDone=(async()=>{for await(const part of inflate){expandedLayerBytes+=part.length;must(expandedLayerBytes<=maxExpandedLayerBytes,'Layer expansion exceeds bound');expandedHash.update(part);}})();inflateDone.catch(()=>{});}
     hash.update(bytes);if(size<=maxMetadata)pieces.push(bytes);if(inflate)await new Promise((accept,reject)=>inflate.write(bytes,error=>error?reject(error):accept()));left-=bytes.length;
    }
    if(inflate){inflate.end();await inflateDone;}
   }finally{inflate?.destroy();}
   const padding=(512-size%512)%512;if(padding)must((await read(padding)).every(byte=>byte===0),'Nonzero tar padding');
   const entry={size,hash:hash.digest('hex'),bytes:size<=maxMetadata?Buffer.concat(pieces):null,compression,expandedHash:expandedHash?.digest('hex')};
   if(/^blobs\/sha256\/[a-f0-9]{64}$/.test(name))must(entry.hash===name.slice(-64),'Blob digest mismatch');
   entries.set(name,entry);
  }
  must(zeros>=2,'Tar footer required');
  const actualArchiveSha256=compressedHash.digest('hex');must(compressedBytes===st.size&&(!archiveSha256||archiveSha256===actualArchiveSha256),'Archive snapshot hash mismatch');
  const json=name=>{const entry=entries.get(name);must(entry?.bytes,'Bounded JSON member required');return JSON.parse(entry.bytes);};
  const manifests=json('manifest.json');must(Array.isArray(manifests)&&manifests.length===1,'One Docker runtime manifest required');
  const docker=manifests[0];must(Array.isArray(docker.RepoTags)&&docker.RepoTags.includes(tag)&&typeof docker.Config==='string'&&Array.isArray(docker.Layers)&&docker.Layers.length>0,'Docker tag/config/layers required');
  const configEntry=entries.get(docker.Config);must(configEntry,'Docker config missing');const config=json(docker.Config),configDigest='sha256:'+configEntry.hash;
  must(config.os==='linux'&&config.architecture==='amd64'&&config.rootfs?.type==='layers'&&Array.isArray(config.rootfs.diff_ids)&&config.rootfs.diff_ids.length===docker.Layers.length&&config.rootfs.diff_ids.every(digest),'Linux amd64 config/layers required');
  const expected=inspect[0];must(expected.Os===config.os&&expected.Architecture===config.architecture,'Inspection platform mismatch');
  for(const key of ['User','Env','Cmd','Entrypoint','WorkingDir','Healthcheck','ExposedPorts','Volumes','Labels','StopSignal','Shell'])must(isDeepStrictEqual(config.config?.[key]??null,expected.Config?.[key]??null),'Archive runtime configuration mismatch');
  if(expected.RootFS?.Layers)must(JSON.stringify(expected.RootFS.Layers)===JSON.stringify(config.rootfs.diff_ids),'Archive rootfs mismatch');
  let kind='config';
  if(entries.has('index.json')){
   must(json('oci-layout').imageLayoutVersion==='1.0.0','OCI layout version mismatch');const index=json('index.json');must(index.schemaVersion===2&&Array.isArray(index.manifests)&&index.manifests.length===1,'One OCI archive root required');
   const roots=index.manifests.filter(item=>item.digest===imageId);must(roots.length===1,'Docker ID does not identify an archive root');
   const runtime=[],attestations=[];let visited=0;
   function blob(descriptor){must(descriptor&&digest(descriptor.digest)&&Number.isSafeInteger(descriptor.size)&&descriptor.size>=0,'Invalid OCI descriptor');const name='blobs/sha256/'+descriptor.digest.slice(7),entry=entries.get(name);must(entry&&entry.size===descriptor.size&&entry.hash===descriptor.digest.slice(7),'OCI descriptor/blob mismatch');return name;}
   function walk(descriptor,depth=0,ancestors=[]){must(depth<=8&&++visited<=128,'OCI graph exceeds bound');const name=blob(descriptor),value=json(name),platforms=descriptor.platform?[...ancestors,descriptor.platform]:ancestors;must(value.schemaVersion===2&&value.mediaType===descriptor.mediaType,'OCI schema/media type mismatch');
    if(['application/vnd.oci.image.index.v1+json','application/vnd.docker.distribution.manifest.list.v2+json'].includes(descriptor.mediaType)){must(Array.isArray(value.manifests)&&value.manifests.length>0,'Empty OCI index');for(const child of value.manifests)walk(child,depth+1,platforms);}
    else{must(['application/vnd.oci.image.manifest.v1+json','application/vnd.docker.distribution.manifest.v2+json'].includes(descriptor.mediaType)&&Array.isArray(value.layers),'Unsupported OCI manifest');const leafConfig=json(blob(value.config));for(const layer of value.layers)blob(layer);
     if(leafConfig.os==='linux'&&leafConfig.architecture==='amd64'){must((depth===0||descriptor.platform)&&platforms.every(platform=>platform.os==='linux'&&platform.architecture==='amd64'&&!platform.variant),'OCI platform/config selection mismatch');runtime.push({...value,descriptorDigest:descriptor.digest});}
     else{must(leafConfig.os==='unknown'&&leafConfig.architecture==='unknown'&&descriptor.platform?.os==='unknown'&&descriptor.platform.architecture==='unknown'&&descriptor.annotations?.['vnd.docker.reference.type']==='attestation-manifest'&&value.layers.every(layer=>layer.mediaType==='application/vnd.in-toto+json'),'Unsupported extra runtime or attestation metadata');attestations.push(descriptor);}
    }
   }
   walk(roots[0]);must(runtime.length===1&&runtime[0].config.digest===configDigest&&JSON.stringify(runtime[0].layers.map(layer=>'blobs/sha256/'+layer.digest.slice(7)))===JSON.stringify(docker.Layers),'Ambiguous or mismatched Docker/OCI runtime manifest');
   for(const descriptor of attestations)must(descriptor.annotations['vnd.docker.reference.digest']===runtime[0].descriptorDigest,'Attestation runtime reference mismatch');
   for(let i=0;i<runtime[0].layers.length;i++){const layer=runtime[0].layers[i],entry=entries.get(docker.Layers[i]),gzip=['application/vnd.oci.image.layer.v1.tar+gzip','application/vnd.docker.image.rootfs.diff.tar.gzip'].includes(layer.mediaType),raw=['application/vnd.oci.image.layer.v1.tar','application/vnd.docker.image.rootfs.diff.tar'].includes(layer.mediaType);must((gzip&&entry.compression==='gzip')||(raw&&entry.compression==='none'),'Unsupported or inconsistent layer compression');must('sha256:'+(gzip?entry.expandedHash:entry.hash)===config.rootfs.diff_ids[i],'OCI layer content/diffID mismatch');}
   kind=roots[0].mediaType.includes('index')||roots[0].mediaType.includes('manifest.list')?'oci-index':'oci-manifest';
  }else{
   must(imageId===configDigest,'Legacy Docker config identity mismatch');
   for(let i=0;i<docker.Layers.length;i++)must(entries.get(docker.Layers[i])?.compression==='none'&&'sha256:'+entries.get(docker.Layers[i])?.hash===config.rootfs.diff_ids[i],'Legacy layer/diffID mismatch');
  }
  return {dockerImageId:imageId,dockerImageIdKind:kind,configDigest,archiveSha256:actualArchiveSha256,platform:'linux/amd64',archiveFormat:'docker-save+gzip',ociLayout:entries.has('oci-layout'),membersVerified:entries.size,layerCount:docker.Layers.length,layerDiffIdsVerified:true,publishedRegistry:false};
 }finally{source?.destroy();decoded?.destroy();if(!source)fs.closeSync(fd);}
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{let expected;if(process.argv.length===4&&process.argv[3]==='--expected-stdin'){const pieces=[];let total=0;for await(const bytes of process.stdin){total+=bytes.length;must(total<=8*1024*1024,'Bounded snapshot required');pieces.push(bytes);}expected=JSON.parse(Buffer.concat(pieces));must(/^[a-f0-9]{64}$/.test(expected.archiveSha256),'Snapshot hash required');}else{must(process.argv.length===5,'Usage');const build=smallJson(process.argv[3]);expected={imageId:build.imageId,tag:build.tag,inspect:smallJson(process.argv[4])};}console.log(JSON.stringify(await verifyImageArchive(process.argv[2],expected)));}
 catch{console.error('Image archive identity verification failed. Require a bounded Docker-save gzip archive with matching Docker ID, tag, config, layers and inspected runtime.');process.exitCode=1;}
}
