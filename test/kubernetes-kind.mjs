// Dedicated disposable kind cluster only. Never uses the user's current context.
import assert from 'node:assert/strict';import {execFileSync,spawn} from 'node:child_process';import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomBytes,randomUUID} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),base=join(root,'deploy/kubernetes');
const nodeImage=process.env.KIND_NODE_IMAGE;
assert.match(nodeImage||'',/^kindest\/node(?::v[0-9.]+)?@sha256:[a-f0-9]{64}$/,'KIND_NODE_IMAGE must be an operator-verified pinned official kindest/node digest');
const name='hook-ci-'+randomUUID().slice(0,8),context='kind-'+name,temp=mkdtempSync(join(tmpdir(),'hook-kind-')),kubeconfig=join(temp,'kubeconfig'),namespace='webhook-replay-lab',image='hook-kind-candidate:'+name;
const env={...process.env,KUBECONFIG:kubeconfig};
const run=(command,args,input)=>execFileSync(command,args,{cwd:root,env,encoding:'utf8',input,timeout:240000,maxBuffer:4*1024*1024,stdio:['pipe','pipe','pipe']});
const kubectl=args=>run('kubectl',['--kubeconfig',kubeconfig,'--context',context,...args]);
let attempted=false,failed=false,forward;
try{
 if(process.env.LAB_TEST_IMAGE)run('docker',['tag',process.env.LAB_TEST_IMAGE,image]);else run('docker',['build','-t',image,'.']);
 const imageID=run('docker',['image','inspect',image,'--format','{{.Id}}']).trim();
 writeFileSync(join(temp,'kind.yaml'),'kind: Cluster\napiVersion: kind.x-k8s.io/v1alpha4\nnetworking:\n  apiServerAddress: "127.0.0.1"\nnodes:\n  - role: control-plane\n',{mode:0o600});
 attempted=true;run('kind',['create','cluster','--name',name,'--kubeconfig',kubeconfig,'--image',nodeImage,'--config',join(temp,'kind.yaml'),'--wait','180s']);
 run('kind',['load','docker-image',image,'--name',name]);
 const files=JSON.parse(readFileSync(join(base,'kustomization.yaml'))).resources;
 const manifests=files.map(file=>JSON.parse(readFileSync(join(base,file))));
 const deployment=manifests.find(x=>x.kind==='Deployment');for(const c of [...deployment.spec.template.spec.initContainers,...deployment.spec.template.spec.containers]){assert.equal(c.image,'REPLACE_WITH_REVIEWED_IMAGE@sha256:REPLACE_WITH_64_HEX');c.image=image;c.imagePullPolicy='Never';}
 const ns=manifests.find(x=>x.kind==='Namespace');writeFileSync(join(temp,'namespace.json'),JSON.stringify(ns));kubectl(['apply','-f',join(temp,'namespace.json')]);
 writeFileSync(join(temp,'admin-token'),randomBytes(32).toString('hex'),{mode:0o600});writeFileSync(join(temp,'storage-key'),randomBytes(32).toString('hex'),{mode:0o600});
 kubectl(['-n',namespace,'create','secret','generic','hook-required-secrets','--from-file=admin-token='+join(temp,'admin-token'),'--from-file=storage-key='+join(temp,'storage-key')]);
 writeFileSync(join(temp,'objects.json'),JSON.stringify({apiVersion:'v1',kind:'List',items:manifests.filter(x=>x.kind!=='Namespace')}));kubectl(['apply','-f',join(temp,'objects.json')]);
 kubectl(['-n',namespace,'rollout','status','deployment/hook','--timeout=180s']);
 // Private client access through the actual Kubernetes port-forward path.
 forward=spawn('kubectl',['--kubeconfig',kubeconfig,'--context',context,'-n',namespace,'port-forward','--address','127.0.0.1','service/hook',':4319'],{env,stdio:['ignore','pipe','pipe']});
 const forwardedPort=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(Error('Private port-forward readiness timeout')),20000);const listen=c=>{output+=c.toString();const m=output.match(/Forwarding from 127\.0\.0\.1:(\d+)/);if(m){clearTimeout(timer);resolve(Number(m[1]));}};forward.stdout.on('data',listen);forward.stderr.on('data',listen);forward.once('error',e=>{clearTimeout(timer);reject(e);});forward.once('exit',()=>{clearTimeout(timer);reject(Error('Private port-forward exited before readiness'));});});
 const client='http://127.0.0.1:'+forwardedPort;assert.equal((await fetch(client+'/healthz',{signal:AbortSignal.timeout(10000)})).status,200);assert.equal((await fetch(client+'/api/events',{signal:AbortSignal.timeout(10000)})).status,401);
 const auth=readFileSync(join(temp,'admin-token'),'utf8');const authorized=await fetch(client+'/api/events',{headers:{authorization:'Bearer '+auth},signal:AbortSignal.timeout(10000)});assert.equal(authorized.status,200);assert.equal((await authorized.json()).persistent,true);
 forward.kill('SIGTERM');await new Promise(r=>{if(forward.exitCode!==null)return r();forward.once('exit',r);});forward=null;
 const pod=()=>JSON.parse(kubectl(['-n',namespace,'get','pods','-l','app.kubernetes.io/name=webhook-replay-lab','-o','json'])).items.find(x=>x.status.phase==='Running').metadata.name;
 const check=String.raw`import fs from 'node:fs';import assert from 'node:assert/strict';assert.equal(process.getuid(),1000);for(const p of ['/private-runtime/private/admin-token','/private-runtime/private/storage-key']){const s=fs.lstatSync(p);assert.equal(s.uid,1000);assert.equal(s.mode&0o077,0);assert.ok(s.isFile());assert.equal(s.nlink,1);}const d=fs.lstatSync('/data/private');assert.equal(d.uid,1000);assert.equal(d.mode&0o077,0);const token=fs.readFileSync(process.env.LAB_TOKEN_FILE,'utf8').trim();const headers={authorization:'Bearer '+token,'content-type':'application/json'};`;
 kubectl(['-n',namespace,'exec',pod(),'-c','lab','--','node','--input-type=module','-e',check+`const r=await fetch('http://127.0.0.1:4319/api/events',{method:'POST',headers,body:JSON.stringify({payload:{synthetic:'kind-persistence',secret:'redact-me'}})});assert.equal(r.status,201);for(const route of ['/ingress','/ingress/stripe']){const denied=await fetch('http://127.0.0.1:4319'+route,{method:'POST',headers,body:'{}'});assert.equal(denied.status,404);}`]);
 kubectl(['-n',namespace,'rollout','restart','deployment/hook']);kubectl(['-n',namespace,'rollout','status','deployment/hook','--timeout=180s']);
 kubectl(['-n',namespace,'exec',pod(),'-c','lab','--','node','--input-type=module','-e',check+`const r=await fetch('http://127.0.0.1:4319/api/events',{headers});assert.equal(r.status,200);const b=await r.json();assert.equal(b.events.length,1);assert.equal(b.events[0].payload.secret,'[REDACTED]');assert.equal(b.persistent,true);assert.equal(b.allowlist.length,0);`]);
 const svc=JSON.parse(kubectl(['-n',namespace,'get','service','hook','-o','json']));assert.equal(svc.spec.type,'ClusterIP');assert.ok(!svc.spec.ports.some(x=>x.nodePort));assert.equal(JSON.parse(kubectl(['-n',namespace,'get','ingress','-o','json'])).items.length,0);
 console.log(JSON.stringify({ok:true,cluster:'disposable-kind',nodeImage,candidateImageID:imageID,nonroot:1000,privateSecretCopies:true,encryptedPVCRestart:true,ingressDisabled:true,privateClusterIP:true,privatePortForwardVerified:true,publicPorts:false,network:'ephemeral Docker bridge, not network-none',networkPolicyEnforcement:'not established by default kind CNI'}));
}catch(error){failed=true;throw error;}finally{
 let cleanupError;if(forward){forward.kill('SIGTERM');await new Promise(r=>{if(forward.exitCode!==null)return r();forward.once('exit',r);setTimeout(()=>{forward.kill('SIGKILL');r();},5000).unref();});}if(attempted){try{run('kind',['delete','cluster','--name',name]);assert.ok(!run('kind',['get','clusters']).split(/\s+/).includes(name),'temporary cluster remains');}catch(e){cleanupError=e;}}
 try{run('docker',['image','rm',image]);}catch{}
 rmSync(temp,{recursive:true,force:true});if(cleanupError){console.error('Disposable Kubernetes cluster cleanup failed');if(!failed)throw cleanupError;}
}
