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
 if(!available||!diagnostics||diagnostics.schemaVersion!==1){add('service_unavailable');return {ok:false,alerts};}
 const d=diagnostics;
 if(!d.storage?.healthy)add('storage_unhealthy');
 if(d.retained?.events>=180)add('event_capacity');
 if(d.retained?.ingressReceipts>=1800)add('receipt_capacity');
 if(d.retained?.outcomes?.unknown>0)add('unknown_delivery');
 const delta=(value,old)=>Number.isSafeInteger(value)&&value>=0?value-(Number.isSafeInteger(old)&&old>=0&&old<=value?old:0):0;
 if(delta(d.process?.signatureFailures,previous?.process?.signatureFailures)>=10)add('signature_failures');
 if(delta(d.process?.requests?.statusClasses?.['5xx'],previous?.process?.requests?.statusClasses?.['5xx'])>0)add('server_errors');
 return {ok:alerts.length===0,alerts};
}
