// Dedicated synthetic loopback workload only. No supplied URL or external target.
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,statSync,writeFileSync,readdirSync} from 'node:fs';
import {tmpdir,cpus,totalmem,platform,arch} from 'node:os';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createLab} from '../src/server.js';
import {createStore,MAX_STORE_BYTES} from '../src/store.js';
import {readBuildInfo} from '../src/build-info.js';
const seconds=Number(process.env.LAB_ENDURANCE_SECONDS||1800);
assert.ok(Number.isInteger(seconds)&&seconds>=10&&seconds<=1800,'Duration must be 10–1800 seconds');
const directory=realpathSync(mkdtempSync(join(tmpdir(),'hook-endurance-'))),path=join(directory,'inbox.enc');
const token='synthetic-endurance-admin-token-000000',key='ab'.repeat(32);
const reference={runtime:readBuildInfo(),sourceCommit:/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||'')?process.env.GITHUB_SHA:null,node:process.versions.node,platform:platform(),arch:arch(),cpuModel:cpus()[0]?.model,cpuCount:cpus().length,hostMemoryBytes:totalmem(),durationSeconds:seconds,latencyBudgetP95Ms:250,limits:{events:200,payloadBytes:65536,requestsPerCredentialPerMinute:120},workload:'20 initial retained events. One request/second; 10-step mix: 2 captures, 2 deletes, 5 reads, 1 bad-signature rejection. 1 KB synthetic field. Final burst: 150 reads at concurrency 8. No outbound replay. CPU/RSS include local driver and service.'};
console.log(JSON.stringify({reference}));
const start=performance.now(),cpuStart=process.cpuUsage(),samples=[],expected=new Set();
let maxRss=0,maxDisk=0,server,base;
const stats={steady:{count:0,statuses:{},latencies:[]},overLimit:{count:0,statuses:{},latencies:[]}};
async function request(route,{body,auth=true,phase='steady'}={}){
 const at=performance.now();const r=await fetch(base+route,{method:body?'POST':'GET',headers:{...(auth?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)});const data=await r.json(),s=stats[phase];s.count++;s.statuses[r.status]=(s.statuses[r.status]||0)+1;s.latencies.push(performance.now()-at);return {status:r.status,data};
}
function sample(){const rss=process.memoryUsage().rss,disk=statSync(path).size;maxRss=Math.max(maxRss,rss);maxDisk=Math.max(maxDisk,disk);assert.ok(disk<=MAX_STORE_BYTES);assert.ok(rss<256*1024*1024,'Combined service/driver RSS exceeds declared 256 MB budget');samples.push({elapsedSeconds:Math.round((performance.now()-start)/1000),rssBytes:rss,snapshotBytes:disk});}
let result;
try{
 const store=createStore({path,key});const initial=Array.from({length:20},(_,i)=>({id:'seed_'+i,createdAt:Date.now(),label:'Synthetic seed',payload:{index:i,value:'x'.repeat(1024),secret:'[REDACTED]'},attempts:[]}));store.save({version:1,events:initial,receipts:[]});for(const event of initial)expected.add(event.id);
 server=createLab({token,ingressKey:'cd'.repeat(32),store});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 let i=0;
 while(performance.now()-start<(seconds-5)*1000){
  const tick=performance.now(),step=i++%10;
  if(step===0||step===7){const r=await request('/api/events',{body:{label:'Synthetic endurance',payload:{index:i,value:'x'.repeat(1024),secret:'must-redact'}}});assert.equal(r.status,201);expected.add(r.data.id);}
  else if(step===3||step===8){const id=expected.values().next().value;if(id){const r=await request('/api/delete',{body:{id}});assert.equal(r.status,200);expected.delete(id);}else assert.equal((await request('/api/events')).status,200);}
  else if(step===5)assert.equal((await request('/ingress',{body:{synthetic:true},auth:false})).status,401);
  else {const r=await request('/api/events');assert.equal(r.status,200);assert.deepEqual(new Set(r.data.events.map(e=>e.id)),expected);assert.ok(r.data.events.every(e=>e.payload.secret==='[REDACTED]'));}
  if(i%30===0||i===1)sample();
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,1000-(performance.now()-tick))));
 }
 let issued=0;await Promise.all(Array.from({length:8},async()=>{while(issued++<150){const r=await request('/api/events',{phase:'overLimit'});assert.ok([200,429].includes(r.status));}}));
 assert.ok(stats.overLimit.statuses[429]>0,'Over-limit phase must exercise bounded rejection');
 await new Promise(resolve=>setTimeout(resolve,Math.max(0,seconds*1000-(performance.now()-start))));sample();
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=null;
 const restored=createStore({path,key});const state=restored.load();assert.deepEqual(new Set(state.events.map(e=>e.id)),expected);restored.close();
 const summary={};for(const [phase,s] of Object.entries(stats)){const sorted=s.latencies.sort((a,b)=>a-b),percent=p=>sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]??null;summary[phase]={requests:s.count,statuses:s.statuses,http5xxRate:Object.entries(s.statuses).filter(([status])=>Number(status)>=500).reduce((total,[,count])=>total+count,0)/s.count,throttledRate:(s.statuses[429]||0)/s.count,expectedAuthRejectionRate:(s.statuses[401]||0)/s.count,p50Ms:percent(.5),p95Ms:percent(.95)};}
 assert.ok(summary.steady.p95Ms<=reference.latencyBudgetP95Ms,'Steady p95 exceeds predeclared 250 ms local budget');
 const cpu=process.cpuUsage(cpuStart);result={ok:true,reference,elapsedSeconds:(performance.now()-start)/1000,summary,maxRssBytes:maxRss,maxSnapshotBytes:maxDisk,cpuMicroseconds:cpu,samples,retainedEvents:expected.size,files:readdirSync(directory).length,limitations:['Synthetic single-process service and driver; not a customer SLA, replay-network benchmark or DDoS test.','Short runs validate the harness only; full acceptance requires durationSeconds=1800.']};
 console.log(JSON.stringify(result));
 if(process.env.LAB_ENDURANCE_OUTPUT)writeFileSync(process.env.LAB_ENDURANCE_OUTPUT,JSON.stringify(result,null,2)+'\n',{mode:0o600});
}finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}rmSync(directory,{recursive:true,force:true});}
