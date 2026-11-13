import fs from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';

const archive='webhook-replay-lab-linux-amd64.tar.gz';
const files=['image/build.json','image/SHA256SUMS','security/image-id.txt','security/image-inspect.json','security/trivy.json','security/node-core-result.json','security/node-core-feed.json','endurance/endurance.json','ci-summary.json','artifact-provenance.json'];
const artifactFiles={'verified-image-linux-amd64':['image/build.json','image/SHA256SUMS','image/'+archive],'image-security-evidence':['security/image-id.txt','security/image-inspect.json','security/trivy.json','security/node-core-result.json','security/node-core-feed.json'],'synthetic-endurance-evidence':['endurance/endurance.json']};
const requireCondition=(condition,message)=>{if(!condition)throw Error(message);};
const hex40=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function regular(path,max){const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);try{const st=fs.fstatSync(fd);requireCondition(st.isFile()&&st.nlink===1&&st.size<=max,'Regular bounded artifact required');return {fd,size:st.size};}catch(error){fs.closeSync(fd);throw error;}}
function read(path,max=8*1024*1024){const {fd,size}=regular(path,max);try{const bytes=Buffer.alloc(size+1);let n=0;while(n<bytes.length){const count=fs.readSync(fd,bytes,n,bytes.length-n,null);if(!count)break;n+=count;}requireCondition(n===size,'Artifact changed while reading');return bytes.subarray(0,n);}finally{fs.closeSync(fd);}}
function fileHash(path){const {fd,size}=regular(path,1024*1024*1024);try{const hash=createHash('sha256'),buffer=Buffer.alloc(1024*1024);let total=0,count;while((count=fs.readSync(fd,buffer,0,buffer.length,null))>0){total+=count;requireCondition(total<=size,'Archive changed while reading');hash.update(buffer.subarray(0,count));}requireCondition(total===size,'Archive changed while reading');return hash.digest('hex');}finally{fs.closeSync(fd);}}

export function validatePacketEvidence({commit,build,inspect,trivy,node,feed,endurance,ci,ciBytes,provenance}) {
 requireCondition(hex40(commit)&&build.commit===commit,'Exact tested source required; prior commits cannot substitute');
 requireCondition(hex40(build.workflowCommit)&&hex40(ci.headSha)&&ci.workflowCommit===build.workflowCommit&&['push','workflow_dispatch','pull_request'].includes(ci.event),'Workflow provenance mismatch');
 requireCondition(Number.isSafeInteger(ci.databaseId)&&ci.databaseId>0&&ci.workflowPath==='.github/workflows/ci.yml'&&provenance?.repository==='chanpollo/webhook-replay-lab'&&provenance.runId===ci.databaseId&&provenance.runAttempt===ci.runAttempt&&provenance.event===ci.event&&provenance.workflowPath===ci.workflowPath&&provenance.apiHeadSha===ci.headSha&&provenance.workflowCommit===build.workflowCommit&&provenance.sourceCommit===commit&&ciBytes&&provenance.ciSummarySha256===digest(ciBytes),'CI run/workflow provenance mismatch');
 if(ci.event==='pull_request')requireCondition(commit===build.workflowCommit&&provenance.mergeCommit?.sha===build.workflowCommit&&Array.isArray(provenance.mergeCommit.parents)&&provenance.mergeCommit.parents.includes(ci.headSha),'PR merge/source ancestry required');
 else requireCondition(ci.headSha===build.workflowCommit&&(ci.event!=='push'||commit===build.workflowCommit),'Event source/workflow mismatch');
 requireCondition(ci.url===`https://github.com/chanpollo/webhook-replay-lab/actions/runs/${ci.databaseId}`&&Array.isArray(provenance.artifacts)&&provenance.artifacts.length===3,'Expected CI workflow/run required');
 for(const [name,expected] of Object.entries(artifactFiles)){const matching=provenance.artifacts.filter(artifact=>artifact.name===name);requireCondition(matching.length===1,'Required artifact provenance missing');const artifact=matching[0];requireCondition(Number.isSafeInteger(artifact.id)&&artifact.id>0&&artifact.runId===ci.databaseId&&artifact.apiHeadSha===ci.headSha&&/^[a-f0-9]{64}$/.test(artifact.zipSha256)&&artifact.digest==='sha256:'+artifact.zipSha256&&artifact.files&&Object.keys(artifact.files).length===expected.length&&expected.every(file=>/^[a-f0-9]{64}$/.test(artifact.files[file])),'Artifact/run digest provenance mismatch');}
 requireCondition(build.platform==='linux/amd64'&&build.archiveFormat==='docker-save+gzip'&&build.publishedRegistry===false,'Unpublished Linux amd64 archive required');
 requireCondition(/^[a-f0-9]{12}$/.test(build.build)&&/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(build.version)&&/^sha256:[a-f0-9]{64}$/.test(build.imageId),'Invalid image identity');
 requireCondition(build.tag===`webhook-replay-lab:${build.version}-${commit.slice(0,12)}-amd64`,'Image tag/source mismatch');
 requireCondition(Array.isArray(inspect)&&inspect.length===1&&inspect[0].Id===build.imageId&&inspect[0].Os==='linux'&&inspect[0].Architecture==='amd64'&&inspect[0].Config?.User==='node','Image inspection mismatch');
 const environment=inspect[0].Config.Env;
 requireCondition(Array.isArray(environment)&&environment.every(value=>typeof value==='string'&&/^(PATH|NODE_VERSION|YARN_VERSION)=/.test(value)),'Unexpected baked environment; manual review required');
 requireCondition(environment.filter(value=>value.startsWith('NODE_VERSION=')).length===1&&environment.includes('NODE_VERSION='+node.node),'Node/image version mismatch');
 requireCondition(trivy.SchemaVersion===2&&trivy.ArtifactType==='container_image'&&trivy.Metadata?.ImageID===build.imageId&&Array.isArray(trivy.Results)&&trivy.Results.some(result=>result.Class==='os-pkgs'&&result.Type==='alpine'),'Image scan identity/coverage missing');
 requireCondition(trivy.Results.every(result=>result.Vulnerabilities===undefined||(Array.isArray(result.Vulnerabilities)&&result.Vulnerabilities.length===0)),'Known image findings require resolution');
 requireCondition(trivy.Results.every(result=>result.Secrets===undefined||(Array.isArray(result.Secrets)&&result.Secrets.length===0)),'Image secret findings require resolution');
 requireCondition(Array.isArray(node.unresolved)&&node.unresolved.length===0&&Array.isArray(node.unparsed)&&node.unparsed.length===0&&Number.isSafeInteger(node.entries)&&node.entries>0&&Number.isSafeInteger(node.matchedMajorRanges)&&node.matchedMajorRanges>=0&&node.matchedMajorRanges<=node.entries&&node.coveredByPatchedRanges===node.matchedMajorRanges&&node.sourceSha256===digest(feed),'Node advisory evidence mismatch or unresolved findings');
 const names=['node (22)','node (24)','container','kubernetes','browser','endurance'];
 requireCondition(ci.conclusion==='success'&&ci.status==='completed'&&/^https:\/\/github\.com\/chanpollo\/webhook-replay-lab\/actions\/runs\/\d+$/.test(ci.url)&&Array.isArray(ci.jobs)&&names.every(name=>ci.jobs.some(job=>job.name===name&&job.conclusion==='success'))&&ci.jobs.every(job=>job.conclusion==='success'),'All required CI jobs must pass');
 requireCondition(endurance.ok===true&&endurance.reference?.sourceCommit===commit&&endurance.reference.runtime?.build===build.build&&endurance.reference.durationSeconds===1800&&Number.isFinite(endurance.elapsedSeconds)&&endurance.elapsedSeconds>=1800&&endurance.reference.latencyBudgetP95Ms===250,'Exact-source full-duration evidence required');
 for(const [phase,allowed] of [['steady',['200','201','401']],['overLimit',['200','429']]]){const summary=endurance.summary?.[phase];requireCondition(summary&&Number.isSafeInteger(summary.requests)&&summary.requests>0&&summary.statuses&&typeof summary.statuses==='object'&&Object.entries(summary.statuses).every(([status,count])=>allowed.includes(status)&&Number.isSafeInteger(count)&&count>=0)&&Object.values(summary.statuses).reduce((sum,count)=>sum+count,0)===summary.requests,'Unexpected or inconsistent workload status counts');}
 const limits=endurance.reference.limits,n=endurance.summary.steady.requests,cycles=Math.floor(n/10),remainder=n%10;
 const captures=2*cycles+Number(remainder>0)+Number(remainder>7),deletes=2*cycles+Number(remainder>3)+Number(remainder>8),rejections=cycles+Number(remainder>5);
 requireCondition(limits?.events===200&&limits.payloadBytes===65536&&limits.requestsPerCredentialPerMinute===120&&n>=Math.ceil(1795*0.95)&&n<=Math.ceil(1795*1.05)&&endurance.summary.steady.statuses['201']===captures&&endurance.summary.steady.statuses['401']===rejections&&endurance.summary.steady.statuses['200']===n-captures-rejections&&endurance.summary.overLimit.requests===150&&endurance.retainedEvents===20+captures-deletes,'Declared workload coverage/mix/limits required');
 requireCondition(Array.isArray(endurance.samples)&&endurance.samples.length===Math.floor(n/30)+2&&endurance.samples.every(sample=>Number.isSafeInteger(sample.elapsedSeconds)&&sample.elapsedSeconds>=0&&sample.elapsedSeconds<=Math.ceil(endurance.elapsedSeconds)&&Number.isSafeInteger(sample.rssBytes)&&sample.rssBytes>0&&sample.rssBytes<256*1024*1024&&Number.isSafeInteger(sample.snapshotBytes)&&sample.snapshotBytes>0&&sample.snapshotBytes<=32*1024*1024)&&endurance.samples.at(-1).elapsedSeconds>=1800&&Math.max(...endurance.samples.map(sample=>sample.rssBytes))===endurance.maxRssBytes&&Math.max(...endurance.samples.map(sample=>sample.snapshotBytes))===endurance.maxSnapshotBytes,'Consistent resource samples required');
 requireCondition(Number.isFinite(endurance.summary?.steady?.p95Ms)&&endurance.summary.steady.p95Ms<=250&&endurance.summary.steady.http5xxRate===0&&endurance.summary.overLimit?.http5xxRate===0&&endurance.summary.overLimit.statuses?.['429']>0&&endurance.maxRssBytes>0&&endurance.maxRssBytes<256*1024*1024&&endurance.maxSnapshotBytes>0&&endurance.maxSnapshotBytes<=32*1024*1024&&endurance.files===1,'Reference workload acceptance failed');
 return {sourceCommit:commit,workflowCommit:build.workflowCommit,build:build.build,version:build.version,imageId:build.imageId,imageTag:build.tag,ciRun:ci.url};
}

export function prepareReleasePacket({evidence,output,commit,repository=fileURLToPath(new URL('../',import.meta.url))}) {
 requireCondition(hex40(commit)&&typeof evidence==='string'&&typeof output==='string','Commit, evidence and output required');
 const retained=new Map(files.map(file=>[file,read(join(evidence,file))]));const json=file=>JSON.parse(retained.get(file));
 const provenance=json('artifact-provenance.json');
 const identity=validatePacketEvidence({commit,build:json('image/build.json'),inspect:json('security/image-inspect.json'),trivy:json('security/trivy.json'),node:json('security/node-core-result.json'),feed:retained.get('security/node-core-feed.json'),endurance:json('endurance/endurance.json'),ci:json('ci-summary.json'),ciBytes:retained.get('ci-summary.json'),provenance});
 const sums=retained.get('image/SHA256SUMS').toString('utf8').trim().match(/^([a-f0-9]{64})  webhook-replay-lab-linux-amd64\.tar\.gz$/);
 const archiveHash=fileHash(join(evidence,'image',archive));requireCondition(sums&&archiveHash===sums[1],'Archive checksum mismatch');
 requireCondition(retained.get('security/image-id.txt').toString('utf8').trim()===identity.imageId,'Scanned image identity mismatch');
 for(const artifact of provenance.artifacts)for(const [file,hash] of Object.entries(artifact.files))requireCondition((file==='image/'+archive?archiveHash:digest(retained.get(file)))===hash,'Artifact content/run binding mismatch');
 const archiveIdentity=JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('./verify-image-archive.mjs',import.meta.url)),join(evidence,'image',archive),'--expected-stdin'],{input:JSON.stringify({imageId:identity.imageId,tag:identity.imageTag,inspect:json('security/image-inspect.json'),archiveSha256:archiveHash}),encoding:'utf8',maxBuffer:1024*1024,timeout:45000,stdio:['pipe','pipe','pipe']}));
 requireCondition(archiveIdentity.dockerImageId===identity.imageId&&archiveIdentity.archiveSha256===archiveHash&&archiveIdentity.platform==='linux/amd64'&&archiveIdentity.layerDiffIdsVerified===true&&/^sha256:[a-f0-9]{64}$/.test(archiveIdentity.configDigest),'Archive proof/snapshot mismatch');
 const parent=fs.realpathSync(dirname(resolve(output))),directory=fs.lstatSync(parent);
 requireCondition(directory.isDirectory()&&(directory.mode&0o022)===0&&(!process.getuid||directory.uid===process.getuid()),'Output parent must be owned and not writable by others');
 output=join(parent,basename(resolve(output)));
 const actual=execFileSync('git',['-C',repository,'rev-parse','--verify',commit+'^{commit}'],{encoding:'utf8'}).trim();requireCondition(actual===commit,'Source object unavailable');
 const workflow=execFileSync('git',['-C',repository,'show',identity.workflowCommit+':.github/workflows/ci.yml'],{maxBuffer:1024*1024});
 const source=gzipSync(execFileSync('git',['-C',repository,'archive','--format=tar','--prefix=source/',commit],{maxBuffer:64*1024*1024}),{mtime:0});
 // Never replace an existing directory or remove partial output automatically.
 fs.mkdirSync(output,{mode:0o700});fs.mkdirSync(join(output,'image'),{mode:0o700});
 fs.copyFileSync(join(evidence,'image',archive),join(output,'image',archive),fs.constants.COPYFILE_EXCL);fs.chmodSync(join(output,'image',archive),0o600);
 requireCondition(fileHash(join(output,'image',archive))===sums[1],'Copied archive checksum mismatch');
 const hashes={[`image/${archive}`]:sums[1]};
 function write(file,bytes){fs.mkdirSync(resolve(output,file,'..'),{recursive:true,mode:0o700});fs.writeFileSync(join(output,file),bytes,{mode:0o600,flag:'wx'});hashes[file]=digest(bytes);}
 for(const [file,bytes] of retained)write('evidence/'+file,bytes);
 write('evidence/archive-identity.json',Buffer.from(JSON.stringify(archiveIdentity,null,2)+'\n'));
 write('evidence/workflow.yml',workflow);
 write('source.tar.gz',source);
 write('README.txt',Buffer.from(`UNRELEASED ENGINEERING PACKET — NOT APPROVED FOR PUBLICATION\nSource: ${commit}\nBuild: ${identity.build}\nCI: ${identity.ciRun}\nVerify SHA256SUMS, extract source.tar.gz, follow source/docs/CONTAINER_IMAGE.md and source/docs/INSTALL.md.\nThis is a Docker-save gzip archive for Linux amd64; modern Docker exports can also contain OCI layout/index blobs. See evidence/archive-identity.json for the distinct Docker ID kind and config digest. No registry publication is established by these local IDs. Load only after verification; do not expose admin routes.\nNo credentials are provisioned and no service was deployed. Real Stripe/Hostinger/public TLS, human acceptance and registry/release approvals remain separate gates.\n`));
 const manifest={...identity,archiveIdentity,archiveSha256:sums[1],published:false,releaseApproved:false,files:hashes};
 write('packet.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
 fs.writeFileSync(join(output,'SHA256SUMS'),Object.entries(hashes).map(([file,hash])=>hash+'  '+file).join('\n')+'\n',{mode:0o600,flag:'wx'});
 return {...identity,output,published:false,releaseApproved:false};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
 try{if(process.argv.length!==5)throw Error();const [evidence,output,commit]=process.argv.slice(2);console.log(JSON.stringify(prepareReleasePacket({evidence,output,commit})));}
 catch{console.error('Release packet preparation failed. Require trusted exact-source CI artifacts, matching checksums/scans/full-duration results, a local source commit and an absent output directory. Inspect partial output before retry. Nothing was published.');process.exitCode=1;}
}
