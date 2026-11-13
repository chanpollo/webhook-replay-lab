#!/usr/bin/env node
// Render only. Does not invoke kubectl, contact a cluster, or read secret inputs.
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
export function renderKubernetes(image){
 if(typeof image!=='string'||image.includes('//')||!/^([a-z0-9][a-z0-9._:/-]*)@sha256:[a-f0-9]{64}$/.test(image))throw Error('A reviewed immutable repository@sha256:<64 lowercase hex> image is required');
 const root=new URL('./',import.meta.url),files=JSON.parse(readFileSync(new URL('kustomization.yaml',root))).resources;
 const items=files.map(file=>JSON.parse(readFileSync(new URL(file,root))));
 const pod=items.find(x=>x.kind==='Deployment').spec.template.spec;
 for(const c of [...pod.initContainers,...pod.containers]){if(c.image!=='REPLACE_WITH_REVIEWED_IMAGE@sha256:REPLACE_WITH_64_HEX')throw Error('Unexpected deployment template image');c.image=image;}
 return {apiVersion:'v1',kind:'List',items};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){try{if(process.argv.length!==4||process.argv[2]!=='--image')throw Error('Usage: node deploy/kubernetes/render.mjs --image <reviewed repository@sha256:digest>');process.stdout.write(JSON.stringify(renderKubernetes(process.argv[3]),null,2)+'\n');}catch(error){process.stderr.write(error.message+'\n');process.exitCode=2;}}
