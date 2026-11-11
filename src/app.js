import {activity, attemptsOf, filterAttempts, outcomeKey, outcomes} from './analytics.js';
const $=id=>document.getElementById(id);
let events=[],selected=null,approval=null,busy=false,session=0,reviewGeneration=0,snapshot=null,historyLimit=20;
const json=value=>JSON.stringify(value,null,2);
async function api(path,body){const startedSession=session;const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+$('token').value,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(startedSession!==session)throw Error('Token changed; unlock inbox to inspect any pending operation.');if(!response.ok){const error=Error(data.error);error.rejected=response.status<500;throw error;}return data;}
function cancel() {reviewGeneration++;approval=null;$('review').hidden=true;$('confirm').value='';}
async function action(fn){if(busy)return;busy=true;$('workbench').setAttribute('aria-busy','true');$('status').textContent='Working…';try{await fn();$('status').textContent='Ready';}catch(e){$('status').textContent=e.message;}finally{busy=false;$('workbench').setAttribute('aria-busy','false');}}
function choose(id){cancel();selected=id;const event=events.find(e=>e.id===id);$('selected').textContent=event?event.label+' • '+new Date(event.createdAt).toLocaleString():'Select an event';$('detail').textContent=event?json(event):'No event selected.';$('export').disabled=$('delete').disabled=!event;render();renderEventAttempts();}
function render(){
  $('eventCount').textContent=String(events.length);
  const inbox=$('events'),query=$('eventSearch').value.trim().toLowerCase();inbox.replaceChildren();
  const visible=events.filter(e=>[e.label,e.id,e.payload?.type].some(value=>String(value||'').toLowerCase().includes(query)));
  for(const event of visible){const b=document.createElement('button');b.className='event'+(event.id===selected?' active':'');b.textContent=event.label;b.setAttribute('aria-pressed',String(event.id===selected));const small=document.createElement('small');small.textContent=new Date(event.createdAt).toLocaleString()+' · '+event.id.slice(0,8)+' · '+event.attempts.length+' retained attempts';b.append(small);b.onclick=()=>choose(event.id);inbox.append(b);}
  if(!visible.length)inbox.textContent=!snapshot?'Unlock your session to load captured events.':events.length?'No events match your search. Clear the search to see all retained captures.':'No events yet. Capture your JSON or the clearly labeled synthetic sample to begin.';
  const old=$('compareWith').value;$('compareWith').replaceChildren(new Option('Choose event',''));for(const e of events)if(e.id!==selected)$('compareWith').add(new Option(e.label+' · '+e.id.slice(0,8),e.id));$('compareWith').value=old;
}
async function refresh(){
  try {
    const data=await api('events');events=data.events;snapshot=data;
    $('storage').textContent=(data.persistent?'Encrypted persistent':'Memory-only')+' · '+data.retentionHours+'-hour retention · '+data.maxEvents+' events · 64 KB/request';
    const oldTarget=$('target').value;$('target').replaceChildren(new Option(data.allowlist.length?'Choose destination':'No approved destinations configured',''));for(const url of data.allowlist)$('target').add(new Option(url,url));if(data.allowlist.includes(oldTarget))$('target').value=oldTarget;
    if(!events.find(e=>e.id===selected))selected=null;choose(selected);renderDashboard();$('refresh').disabled=false;
    $('freshness').textContent='Server snapshot: '+new Date(data.serverTime).toLocaleString()+'. Manual refresh; not a live stream.';
  } catch(error) { if(snapshot)$('freshness').textContent='Refresh failed. Displaying an older snapshot; do not treat these counts as current.';throw error; }
}
$('connect').onclick=()=>action(refresh);
$('token').oninput=()=>{session++;events=[];snapshot=null;historyLimit=20;choose(null);renderDashboard();$('refresh').disabled=true;$('freshness').textContent='Locked. Unlock to load actual captured records.';$('detail').textContent='Locked';$('storage').textContent='Locked';$('diff').textContent='No comparison yet.';$('result').textContent='No replay result in this session.';$('target').replaceChildren(new Option('Unlock to load destinations',''));$('status').textContent='Token changed; unlock inbox';};
$('capture').onclick=()=>action(async()=>{const event=await api('events',{label:$('label').value,payload:JSON.parse($('payload').value)});await refresh();choose(event.id);});
$('sample').onclick=()=>{$('label').value='Synthetic order';$('payload').value=json({type:'order.created',order:{id:'demo-001',amount:1499,currency:'THB'},email:'demo@example.test',token:'synthetic-secret'});};
$('export').onclick=()=>action(async()=>{const fixture=await api('events/'+selected+'/fixture');const url=URL.createObjectURL(new Blob([json(fixture)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='webhook-fixture-'+selected+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('delete').onclick=()=>action(async()=>{cancel();await api('delete',{id:selected});await refresh();});
$('compare').onclick=()=>action(async()=>{$('diff').textContent=json(await api('compare',{a:selected,b:$('compareWith').value}));});
$('target').onchange=cancel;
$('prepare').onclick=()=>action(async()=>{cancel();const generation=reviewGeneration;const pending=await api('prepare',{id:selected,url:$('target').value});if(generation!==reviewGeneration)return;approval=pending;$('warning').textContent=approval.warning+' Destination: '+approval.url+' Payload SHA-256: '+approval.hash+' Confirmation expires in 60 seconds.';$('review').hidden=false;});
$('cancel').onclick=cancel;
$('send').onclick=()=>action(async()=>{if(!approval)throw Error('Review replay first');const nonce=approval.nonce,confirm=$('confirm').value;cancel();$('result').textContent='Sending once. An interrupted connection may leave the delivery outcome unknown.';try{const result=await api('replay',{nonce,confirm});$('result').textContent=json(result);await refresh();}catch(error){$('result').textContent=error.rejected?'Server rejected request: '+error.message:'Replay result unavailable. Delivery may be unknown; refresh and inspect destination before another attempt.';throw error;}});

const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
const svgNode=(tag,attributes={})=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attributes))el.setAttribute(key,String(value));return el;};
const dateText=at=>Number.isFinite(at)?new Date(at).toLocaleString():'Timestamp unavailable';
function attemptCard(attempt, link=true){
  const card=node('article',undefined,'attempt-card'),top=node('div',undefined,'attempt-top');
  if(link){const button=node('button',attempt.eventLabel||'Open captured event','secondary');button.onclick=()=>{choose(attempt.eventId);showView('workbench');$('inspect-title').scrollIntoView({block:'start'});$('detail').focus({preventScroll:true});};top.append(button);}
  const time=node('time',dateText(attempt.at));if(Number.isFinite(attempt.at))time.dateTime=new Date(attempt.at).toISOString();top.append(time);card.append(top);
  const key=outcomeKey(attempt),label=outcomes.find(([id])=>id===key)[1],meta=node('div',undefined,'attempt-meta');
  meta.append(node('strong',label,'attempt-state'+(['unknown','http_error','blocked'].includes(key)?' warning':'')));
  if(Number.isInteger(attempt.status))meta.append(node('span','HTTP '+attempt.status));
  meta.append(node('span',Number.isFinite(attempt.durationMs)?attempt.durationMs+' ms':'Latency not recorded'));card.append(meta);
  card.append(node('p',attempt.url||'Destination unavailable'),node('p','Attempt ID: '+(attempt.id||'Unavailable'),'attempt-id'));
  if(link)card.append(node('p','Event ID: '+attempt.eventId,'attempt-id'));
  if(attempt.error)card.append(node('p',attempt.error));
  if(key==='unknown')card.append(node('p','Check receiver logs using the attempt ID before considering another replay. A new attempt has a new idempotency key.'));
  if(attempt.redirectBlocked)card.append(node('p','Redirect blocked; no redirected request was sent.'));
  return card;
}
function renderEventAttempts(){
  const target=$('eventAttempts');target.replaceChildren();const event=events.find(e=>e.id===selected);
  if(!event){target.textContent='Select an event to inspect its replay history.';return;}
  if(!event.attempts.length){target.textContent='No replay attempts recorded for this event.';return;}
  for(const attempt of attemptsOf([event]))target.append(attemptCard(attempt,false));
}
function renderHistory(){
  const target=$('history');target.replaceChildren();$('moreHistory').hidden=true;
  if(!snapshot){$('historyWindow').textContent='';target.textContent='Unlock to view retained replay attempts.';$('historyCount').textContent='0';return;}
  const data=activity(events,snapshot.serverTime,Number($('timeRange').value));
  const filtered=filterAttempts(data.attempts,$('historySearch').value,$('outcomeFilter').value);
  $('historyCount').textContent=filtered.length+' / '+data.attempts.length;$('historyWindow').textContent='Last '+$('timeRange').value+' hours · snapshot '+dateText(snapshot.serverTime);
  if(!filtered.length){target.append(node('p',data.attempts.length?'No attempts match these filters. Try all outcomes or clear your search.':'No retained replay attempts in this time window. Capturing an event does not send it.','empty-state'));return;}
  for(const attempt of filtered.slice(0,historyLimit))target.append(attemptCard(attempt));
  $('moreHistory').hidden=filtered.length<=historyLimit;
  $('moreHistory').textContent='Show next '+Math.min(20,filtered.length-historyLimit)+' attempts';
}
function renderDashboard(){
  for(const id of ['metrics','activityChart','outcomeChart','chartData'])$(id).replaceChildren();
  if(!snapshot){$('activityChart').append(node('p','Unlock to see activity.','empty-state'));$('outcomeChart').append(node('p','No authenticated data loaded.','empty-state'));$('retention').textContent='History is bounded, not a complete audit log.';renderHistory();return;}
  const data=activity(events,snapshot.serverTime,Number($('timeRange').value));
  const metrics=[['Captured events',data.captures,'Captures in selected window'],['Retained replay starts',data.attempts.length,'Not incoming provider deliveries'],['Unknown delivery',data.counts.unknown,'Check receiver before retrying'],['Median response time',data.medianMs===null?'—':Math.round(data.medianMs)+' ms',data.durationCount+' recorded response durations']];
  for(const [title,value,hint] of metrics){const card=node('div',undefined,'metric'+(title==='Unknown delivery'&&value?' attention':''));card.append(node('span',title),node('strong',String(value)),node('small',hint));if(title==='Unknown delivery'&&value){const inspect=node('button','Inspect unknown →','metric-link');inspect.onclick=()=>{$('outcomeFilter').value='unknown';$('historySearch').value='';historyLimit=20;renderHistory();showView('history');$('historySearch').focus();};card.append(inspect);}$('metrics').append(card);}
  $('retention').textContent=(snapshot.persistent?'Encrypted persistent storage: retained history survives a restart.':'Memory-only storage: all history is lost on restart.')+' Events expire '+snapshot.retentionHours+' hours after capture; up to '+snapshot.maxEvents+' events and '+snapshot.maxAttemptsPerEvent+' most recent attempts per event. Deletion, expiry and attempt caps remove records from all views. Not a full audit log. Includes synthetic samples if you capture them.';
  renderActivityChart(data);
  const maximum=Math.max(1,...Object.values(data.counts));
  for(const [key,label] of outcomes){const row=node('div',undefined,'outcome-row');row.dataset.outcome=key;row.append(node('span',label),node('strong',String(data.counts[key])));const bar=svgNode('svg',{viewBox:'0 0 100 5','aria-hidden':'true',preserveAspectRatio:'none'});bar.append(svgNode('rect',{width:100,height:5,class:'outcome-track'}),svgNode('rect',{width:100*data.counts[key]/maximum,height:5,class:'outcome-fill'}));row.append(bar);$('outcomeChart').append(row);}
  renderHistory();
}
function renderActivityChart(data){
  const maximum=Math.max(1,...data.buckets.flatMap(b=>[b.captures,b.attempts]));
  const svg=svgNode('svg',{viewBox:'0 0 600 155',class:'activity-svg',role:'img','aria-label':data.captures+' captures and '+data.attempts.length+' retained replay starts. Exact counts and bucket times in View chart data.'});
  svg.append(svgNode('line',{x1:30,x2:590,y1:145,y2:145,class:'chart-axis'}));
  const maxLabel=svgNode('text',{x:0,y:18,class:'chart-label'});maxLabel.textContent=String(maximum);svg.append(maxLabel);
  data.buckets.forEach((bucket,i)=>{const x=36+i*46;for(const [key,offset,css] of [['captures',0,'capture-bar'],['attempts',18,'attempt-bar']]){const height=120*bucket[key]/maximum;const rect=svgNode('rect',{x:x+offset,y:145-height,width:14,height,class:css});const title=svgNode('title');title.textContent=dateText(bucket.start)+' – '+dateText(bucket.end)+': '+bucket[key]+' '+key;rect.append(title);svg.append(rect);}});
  $('activityChart').append(svg);const axis=node('div',undefined,'chart-times');axis.append(node('span',dateText(data.start)),node('span',dateText(data.end)));$('activityChart').append(axis);const legend=node('div',undefined,'chart-legend');for(const [label,css] of [['Captures',''],['Replay starts','attempts']]){const item=node('span');item.append(node('i',undefined,'legend-swatch '+css),document.createTextNode(label));legend.append(item);}$('activityChart').append(legend);
  if(!data.captures&&!data.attempts.length)$('activityChart').append(node('p','No retained activity in this window.','hint'));
  const table=node('table'),caption=node('caption','Time buckets use server snapshot time; timestamps shown in your local timezone. Each bucket excludes its start and includes its end.');table.append(caption);
  const head=node('thead'),heading=node('tr');for(const label of ['Bucket start','Bucket end','Captures','Replay starts']){const th=node('th',label);th.scope='col';heading.append(th);}head.append(heading);table.append(head);
  const body=node('tbody');for(const b of data.buckets){const row=node('tr');for(const value of [dateText(b.start),dateText(b.end),b.captures,b.attempts])row.append(node('td',String(value)));body.append(row);}table.append(body);$('chartData').append(table);
}
$('refresh').onclick=()=>action(refresh);
$('eventSearch').oninput=render;
$('historySearch').oninput=$('outcomeFilter').onchange=()=>{historyLimit=20;renderHistory();};
$('timeRange').onchange=()=>{historyLimit=20;renderDashboard();};
$('moreHistory').onclick=()=>{historyLimit+=20;renderHistory();};
renderDashboard();

const views=['overview','history','workbench'];
function showView(name,writeHistory=true){if(writeHistory&&location.hash!=='#'+name)history.pushState(null,'','#'+name);for(const view of views){const active=view===name;$('view-'+view).hidden=!active;$('tab-'+view).setAttribute('aria-selected',String(active));$('tab-'+view).tabIndex=active?0:-1;}cancel();}
for(const view of views){$('tab-'+view).onclick=()=>showView(view);$('tab-'+view).onkeydown=event=>{let index=views.indexOf(view);if(event.key==='ArrowRight')index=(index+1)%views.length;else if(event.key==='ArrowLeft')index=(index+views.length-1)%views.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=views.length-1;else return;event.preventDefault();showView(views[index]);$('tab-'+views[index]).focus();};}

addEventListener('popstate',()=>showView(views.includes(location.hash.slice(1))?location.hash.slice(1):'overview',false));
showView(views.includes(location.hash.slice(1))?location.hash.slice(1):'overview',false);
