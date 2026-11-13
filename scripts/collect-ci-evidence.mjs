import fs from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';

const repository='chanpollo/webhook-replay-lab';
const archive='webhook-replay-lab-linux-amd64.tar.gz';
const layouts={
 'verified-image-linux-amd64':{directory:'image',members:{'build.json':8*1024*1024,SHA256SUMS:4096,[archive]:1024*1024*1024}},
 'image-security-evidence':{directory:'security',members:{'image-id.txt':4096,'image-inspect.json':8*1024*1024,'trivy.json':8*1024*1024,'node-core-result.json':8*1024*1024,'node-core-feed.json':8*1024*1024}},
 'synthetic-endurance-evidence':{directory:'endurance',members:{'endurance.json':8*1024*1024},ignored:['endurance.log']}
};
const check=(condition)=>{if(!condition)throw Error('CI evidence validation failed');};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fileHash(path){const fd=fs.openSync(path,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const h=createHash('sha256'),buffer=Buffer.alloc(1024*1024);let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)h.update(buffer.subarray(0,n));return h.digest('hex');}finally{fs.closeSync(fd);}}
function api(path){return JSON.parse(execFileSync('gh',['api','--hostname','github.com',path],{encoding:'utf8',maxBuffer:8*1024*1024,timeout:60000}));}
function commandFile(command,args,path,max){return new Promise((resolvePromise,reject)=>{
 const fd=fs.openSync(path,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600),child=spawn(command,args,{stdio:['ignore','pipe','pipe']});let size=0,failed=false,closed=false;
 const timer=setTimeout(()=>{failed=true;child.kill('SIGKILL');},240000);
 const close=()=>{if(!closed){closed=true;fs.closeSync(fd);}clearTimeout(timer);};
 child.stdout.on('data',bytes=>{size+=bytes.length;if(size>max){failed=true;child.kill('SIGKILL');return;}try{fs.writeFileSync(fd,bytes);}catch{failed=true;child.kill('SIGKILL');}});child.stderr.resume();
 child.once('error',()=>{close();reject(Error('Evidence transfer failed'));});child.once('close',code=>{close();code===0&&!failed?resolvePromise():reject(Error('Evidence transfer failed'));});
});}

export async function collectCIEvidence({runId,output}) {
 check(typeof runId==='string'&&/^[1-9][0-9]{0,19}$/.test(runId)&&typeof output==='string');
 const run=api(`repos/${repository}/actions/runs/${runId}`),jobs=api(`repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`),listing=api(`repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`);
 check(String(run.id)===runId&&run.repository?.full_name===repository&&run.path==='.github/workflows/ci.yml'&&['push','workflow_dispatch','pull_request'].includes(run.event)&&run.status==='completed'&&run.conclusion==='success'&&jobs.total_count<=100&&listing.total_count<=100);
 const parent=fs.realpathSync(dirname(resolve(output))),st=fs.lstatSync(parent);check(st.isDirectory()&&(st.mode&0o022)===0&&(!process.getuid||st.uid===process.getuid()));output=join(parent,basename(resolve(output)));fs.mkdirSync(output,{mode:0o700});
 const summary={databaseId:run.id,runAttempt:run.run_attempt,event:run.event,workflowPath:run.path,workflowDatabaseId:run.workflow_id,headSha:run.head_sha,status:run.status,conclusion:run.conclusion,url:run.html_url,jobs:jobs.jobs.map(job=>({name:job.name,conclusion:job.conclusion,status:job.status,url:job.html_url}))};
 const provenance={repository,runId:run.id,runAttempt:run.run_attempt,event:run.event,workflowPath:run.path,apiHeadSha:run.head_sha,artifacts:[]};
 for(const [name,layout] of Object.entries(layouts)){
  const matches=listing.artifacts.filter(artifact=>artifact.name===name);check(matches.length===1);const artifact=matches[0];
  check(!artifact.expired&&artifact.workflow_run?.id===run.id&&artifact.workflow_run.head_sha===run.head_sha&&/^sha256:[a-f0-9]{64}$/.test(artifact.digest||'')&&artifact.size_in_bytes<=1024*1024*1024);
  const zip=join(output,`.artifact-${artifact.id}.zip`);await commandFile('gh',['api','--hostname','github.com',`repos/${repository}/actions/artifacts/${artifact.id}/zip`],zip,1024*1024*1024);check('sha256:'+fileHash(zip)===artifact.digest);
  const members=execFileSync('unzip',['-Z1',zip],{encoding:'utf8',maxBuffer:65536,timeout:10000}).trim().split('\n');
  check(new Set(members).size===members.length&&members.every(member=>Object.hasOwn(layout.members,member)||(layout.ignored||[]).includes(member))&&Object.keys(layout.members).every(member=>members.includes(member)));
  const directory=join(output,layout.directory);fs.mkdirSync(directory,{mode:0o700});const receipt={id:artifact.id,name,runId:artifact.workflow_run.id,apiHeadSha:artifact.workflow_run.head_sha,digest:artifact.digest,zipSha256:fileHash(zip),files:{}};
  for(const [member,max] of Object.entries(layout.members)){const target=join(directory,member);await commandFile('unzip',['-p',zip,member],target,max);receipt.files[layout.directory+'/'+member]=fileHash(target);}
  provenance.artifacts.push(receipt);fs.unlinkSync(zip);
 }
 const build=JSON.parse(fs.readFileSync(join(output,'image/build.json'),'utf8'));check(/^[a-f0-9]{40}$/.test(build.commit||'')&&/^[a-f0-9]{40}$/.test(build.workflowCommit||''));
 if(run.event==='pull_request'){const merge=api(`repos/${repository}/git/commits/${build.workflowCommit}`);check(build.commit===build.workflowCommit&&merge.sha===build.workflowCommit&&Array.isArray(merge.parents)&&merge.parents.some(parent=>parent.sha===run.head_sha));provenance.mergeCommit={sha:merge.sha,parents:merge.parents.map(parent=>parent.sha)};}
 else check(build.workflowCommit===run.head_sha&&(run.event!=='push'||build.commit===run.head_sha));
 summary.workflowCommit=build.workflowCommit;provenance.workflowCommit=build.workflowCommit;provenance.sourceCommit=build.commit;
 const summaryBytes=Buffer.from(JSON.stringify(summary,null,2)+'\n');fs.writeFileSync(join(output,'ci-summary.json'),summaryBytes,{mode:0o600,flag:'wx'});provenance.ciSummarySha256=hash(summaryBytes);
 fs.writeFileSync(join(output,'artifact-provenance.json'),JSON.stringify(provenance,null,2)+'\n',{mode:0o600,flag:'wx'});
 return {collected:true,runId:run.id,output,published:false};
}
function isMain(){try{return Boolean(process.argv[1])&&fs.realpathSync(process.argv[1])===fileURLToPath(import.meta.url);}catch{return false;}}
if(isMain()){
 try{if(process.argv.length!==4)throw Error();console.log(JSON.stringify(await collectCIEvidence({runId:process.argv[2],output:process.argv[3]})));}
 catch{console.error('CI evidence collection failed. Require authenticated GitHub access, a successful exact run, verified artifact digests, gh/unzip and an absent private output directory. Inspect partial output; nothing was published.');process.exitCode=1;}
}
