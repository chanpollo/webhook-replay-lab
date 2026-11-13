import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationalMetrics} from '../src/operations.js';
import {evaluateAlerts} from '../src/alerts.js';
import {checkAlerts} from '../bin/alerts.mjs';
import {createLab} from '../src/server.js';
const token='synthetic-alert-admin-token-00000000';
test('alerts cover recovery, retained capacity, unknown delivery and fixed counter deltas without secrets',()=>{
 const m=createOperationalMetrics();for(let i=0;i<10;i++)m.recordSignatureFailure();
 const d=m.snapshot({events:Array.from({length:180},()=>({payload:{secret:'private-payload'},attempts:[{outcome:'unknown_delivery',url:'private-url'}]})),receipts:1800,storageHealthy:false});
 const result=evaluateAlerts({diagnostics:d});assert.deepEqual(result.alerts.map(a=>a.code),['storage_unhealthy','event_capacity','receipt_capacity','unknown_delivery','signature_failures']);for(const secret of ['private-payload','private-url',token])assert.equal(JSON.stringify(result).includes(secret),false);
 assert.equal(evaluateAlerts({diagnostics:m.snapshot(),previous:m.snapshot()}).ok,true);
 const reset=m.snapshot();reset.process.signatureFailures=2;assert.equal(evaluateAlerts({diagnostics:reset,previous:d}).ok,true);
 assert.deepEqual(evaluateAlerts({available:false}).alerts.map(a=>a.code),['service_unavailable']);
 assert.deepEqual(evaluateAlerts({diagnostics:{schemaVersion:1,storage:{healthy:true}}}).alerts.map(a=>a.code),['service_unavailable']);
 const oldService=m.snapshot();delete oldService.process.signatureFailures;assert.equal(evaluateAlerts({diagnostics:oldService}).ok,false);
 const restarted=m.snapshot();restarted.uptimeSeconds=1;restarted.process.signatureFailures=15;const beforeRestart=m.snapshot();beforeRestart.uptimeSeconds=100;assert.equal(evaluateAlerts({diagnostics:restarted,previous:beforeRestart}).alerts.some(a=>a.code==='signature_failures'),true);
 const errors=m.snapshot();errors.process.requests.statusClasses['5xx']=1;assert.equal(evaluateAlerts({diagnostics:errors}).alerts.some(a=>a.code==='server_errors'),true);
});
test('local alert probe authenticates, rejects remote URLs before fetch and never follows redirects',async t=>{
 const server=createLab({token,ingressKey:'ab'.repeat(32),store:{load:()=>null,save(){},close(){}}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));const base='http://127.0.0.1:'+server.address().port;
 assert.equal((await checkAlerts({base,token})).result.ok,true);
 for(let i=0;i<10;i++)assert.equal((await fetch(base+'/ingress',{method:'POST'})).status,401);
 const failed=await checkAlerts({base,token});assert.equal(failed.result.alerts.some(a=>a.code==='signature_failures'),true);assert.equal((await checkAlerts({base,token,previous:failed.diagnostics})).result.ok,true);
 const denied=await checkAlerts({base,token:'synthetic-wrong-admin-token-000000000'});assert.equal(denied.result.ok,false);assert.equal(denied.diagnostics,null);
 for(const candidate of ['https://example.com','http://localhost:4319','http://127.0.0.1:4319/api/events','http://secret@127.0.0.1:4319','http://127.0.0.1:4319?secret'])await assert.rejects(checkAlerts({base:candidate,token}));
});
