// Fixed local operator signals. Never copy server-controlled text into output.
const actions={
 service_unavailable:'Check the private service, health, storage permissions and container logs; keep replay stopped until recovered.',
 storage_unhealthy:'Stop writers and follow the recovery runbook; preserve the original snapshot and key.',
 event_capacity:'Export reviewed fixtures or delete unneeded events; inspect retention before accepting more captures.',
 receipt_capacity:'Inspect receiver traffic and wait for the documented receipt window; do not bypass deduplication.',
 signature_failures:'Check sender clock and signing-key configuration; inspect ingress isolation and abuse limits without logging signatures.',
 unknown_delivery:'Inspect receiver logs using retained attempt IDs before considering another replay.',
 server_errors:'Inspect private health and storage; investigate errors before replaying.'
};
export function evaluateAlerts({diagnostics,previous=null,available=true}={}) {
 const alerts=[];const add=code=>alerts.push({code,action:actions[code]});
 const count=value=>Number.isSafeInteger(value)&&value>=0;
 if(!available||!diagnostics||diagnostics.schemaVersion!==1||typeof diagnostics.storage?.healthy!=='boolean'||![diagnostics.uptimeSeconds,diagnostics.retained?.events,diagnostics.retained?.ingressReceipts,diagnostics.retained?.outcomes?.unknown,diagnostics.process?.signatureFailures,diagnostics.process?.requests?.statusClasses?.['5xx']].every(count)){add('service_unavailable');return {ok:false,alerts};}
 const d=diagnostics;
 if(!d.storage?.healthy)add('storage_unhealthy');
 if(d.retained?.events>=180)add('event_capacity');
 if(d.retained?.ingressReceipts>=1800)add('receipt_capacity');
 if(d.retained?.outcomes?.unknown>0)add('unknown_delivery');
 const delta=(value,old)=>Number.isSafeInteger(value)&&value>=0?value-(Number.isSafeInteger(old)&&old>=0&&old<=value?old:0):0;
 const baseline=previous&&d.uptimeSeconds>=previous.uptimeSeconds?previous:null;
 if(delta(d.process?.signatureFailures,baseline?.process?.signatureFailures)>=10)add('signature_failures');
 if(delta(d.process?.requests?.statusClasses?.['5xx'],baseline?.process?.requests?.statusClasses?.['5xx'])>0)add('server_errors');
 return {ok:alerts.length===0,alerts};
}
