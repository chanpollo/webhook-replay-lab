import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {collectCIEvidence} from '../scripts/collect-ci-evidence.mjs';
const commit='c'.repeat(40),repository='chanpollo/webhook-replay-lab';
test('collector pins GitHub host, verifies same-run ZIP digests, distinguishes PR merge and rejects corrupted bytes without network',async t=>{
 const directory=fs.mkdtempSync(join(tmpdir(),'hook-collector-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));const bin=join(directory,'bin');fs.mkdirSync(bin);
 const groups=[['verified-image-linux-amd64',['build.json','SHA256SUMS','webhook-replay-lab-linux-amd64.tar.gz']],['image-security-evidence',['image-id.txt','image-inspect.json','trivy.json','node-core-result.json','node-core-feed.json']],['synthetic-endurance-evidence',['endurance.json']]];
 const routes={},artifacts=[];let id=1;
 for(const [name,members] of groups){const folder=join(directory,name);fs.mkdirSync(folder);for(const member of members)fs.writeFileSync(join(folder,member),member==='build.json'?JSON.stringify({commit,workflowCommit:commit}):JSON.stringify({synthetic:true}));const zip=join(directory,name+'.zip');execFileSync('zip',['-q','-j',zip,...members.map(member=>join(folder,member))]);artifacts.push({id,name,expired:false,size_in_bytes:fs.statSync(zip).size,digest:'sha256:'+createHash('sha256').update(fs.readFileSync(zip)).digest('hex'),workflow_run:{id:123,head_sha:commit}});routes[`repos/${repository}/actions/artifacts/${id}/zip`]=zip;id++;}
 const run={id:123,run_attempt:1,workflow_id:42,path:'.github/workflows/ci.yml',event:'push',head_sha:commit,status:'completed',conclusion:'success',html_url:`https://github.com/${repository}/actions/runs/123`,repository:{full_name:repository}};
 const jobs={total_count:6,jobs:['node (22)','node (24)','container','kubernetes','browser','endurance'].map(name=>({name,conclusion:'success',status:'completed'}))};
 const runFile=join(directory,'run.json'),artifactFile=join(directory,'artifacts.json'),jobsFile=join(directory,'jobs.json'),mergeFile=join(directory,'merge.json');const save=()=>{fs.writeFileSync(runFile,JSON.stringify(run));fs.writeFileSync(artifactFile,JSON.stringify({total_count:3,artifacts}));};save();fs.writeFileSync(jobsFile,JSON.stringify(jobs));
 Object.assign(routes,{[`repos/${repository}/actions/runs/123`]:runFile,[`repos/${repository}/actions/runs/123/jobs?filter=latest&per_page=100`]:jobsFile,[`repos/${repository}/actions/runs/123/artifacts?per_page=100`]:artifactFile,[`repos/${repository}/git/commits/${commit}`]:mergeFile});
 fs.writeFileSync(join(bin,'gh'),`#!${process.execPath}\nconst fs=require('fs'),args=process.argv.slice(2),routes=${JSON.stringify(routes)};if(args[0]!=='api'||args[1]!=='--hostname'||args[2]!=='github.com'||!Object.hasOwn(routes,args[3]))process.exit(97);process.stdout.write(fs.readFileSync(routes[args[3]]));\n`,{mode:0o700});
 const oldPath=process.env.PATH,oldHost=process.env.GH_HOST;process.env.PATH=bin+':'+oldPath;process.env.GH_HOST='untrusted.invalid';
 try{
  const output=join(directory,'push');assert.equal((await collectCIEvidence({runId:'123',output})).collected,true);const proof=JSON.parse(fs.readFileSync(join(output,'artifact-provenance.json')));assert.equal(proof.runId,123);assert.equal(proof.sourceCommit,commit);assert.equal(proof.artifacts.length,3);for(const artifact of proof.artifacts)assert.equal(artifact.digest,'sha256:'+artifact.zipSha256);
  const head='a'.repeat(40);run.event='pull_request';run.head_sha=head;for(const artifact of artifacts)artifact.workflow_run.head_sha=head;save();fs.writeFileSync(mergeFile,JSON.stringify({sha:commit,parents:[{sha:'b'.repeat(40)},{sha:head}]}));const pr=join(directory,'pr');await collectCIEvidence({runId:'123',output:pr});const summary=JSON.parse(fs.readFileSync(join(pr,'ci-summary.json')));assert.equal(summary.headSha,head);assert.equal(summary.workflowCommit,commit);
  fs.appendFileSync(routes[`repos/${repository}/actions/artifacts/1/zip`],'corrupt');await assert.rejects(collectCIEvidence({runId:'123',output:join(directory,'corrupt')}),/validation/);
 }finally{if(oldPath===undefined)delete process.env.PATH;else process.env.PATH=oldPath;if(oldHost===undefined)delete process.env.GH_HOST;else process.env.GH_HOST=oldHost;}
});
