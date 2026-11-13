// Low-cardinality operational counters only. Never retain request URLs, headers,
// principal IDs, payloads, destination URLs or raw failure messages.
import {outcomeKey} from './analytics.js';
const categories=['unknown','http_error','blocked','http_ok','active','unclassified'];
const emptyOutcomes=()=>Object.fromEntries(categories.map(k=>[k,0]));
const bounded=value=>Number.isFinite(value)?Math.min(Number.MAX_SAFE_INTEGER,Math.max(0,Math.floor(value))):0;
export function createOperationalMetrics({now=Date.now}={}) {
 const startedAt=now();
 const requests={started:0,completed:0,aborted:0,inFlight:0,statusClasses:{'1xx':0,'2xx':0,'3xx':0,'4xx':0,'5xx':0,other:0}};
 const replays=emptyOutcomes();
 let signatureFailures=0;
 const increment=(obj,key)=>{obj[key]=bounded(obj[key]+1);};
 return Object.freeze({
  observeResponse(res){
   increment(requests,'started');increment(requests,'inFlight');let settled=false;
   const finish=()=>{if(settled)return;settled=true;requests.inFlight=Math.max(0,requests.inFlight-1);increment(requests,'completed');const code=Number(res.statusCode),group=Number.isInteger(code)&&code>=100&&code<=599?Math.floor(code/100)+'xx':'other';increment(requests.statusClasses,group);};
   const close=()=>{if(settled)return;settled=true;requests.inFlight=Math.max(0,requests.inFlight-1);increment(requests,'aborted');};
   res.once('finish',finish);res.once('close',close);
  },
  recordReplay(attempt){increment(replays,outcomeKey(attempt||{}));},
  recordSignatureFailure(){signatureFailures=bounded(signatureFailures+1);},
  snapshot({events=[],pendingApprovals=0,receipts=0,persistent=false,ingressEnabled=false,storageHealthy=true}={}){
   const retained={events:0,attempts:0,outcomes:emptyOutcomes(),pendingApprovals:bounded(pendingApprovals),ingressReceipts:bounded(receipts)};
   // The store enforces these bounds; also bound diagnostic traversal defensively.
   for(const event of events){if(retained.events>=200)break;retained.events++;for(const attempt of (Array.isArray(event.attempts)?event.attempts:[]).slice(-20)){retained.attempts++;increment(retained.outcomes,outcomeKey(attempt||{}));}}
   return {schemaVersion:1,uptimeSeconds:bounded((now()-startedAt)/1000),storage:{mode:persistent?'encrypted':'memory',healthy:!!storageHealthy},ingressEnabled:!!ingressEnabled,limits:{maxEvents:200,maxAttemptsPerEvent:20,retentionHours:24,maxPendingApprovals:100,maxIngressReceipts:2000},retained,process:{requests:{...requests,statusClasses:{...requests.statusClasses}},signatureFailures,replayOutcomes:{...replays}}};
  }
 });
}
