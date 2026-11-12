import {activity, attemptsOf, filterAttempts, outcomeKey, outcomes} from './analytics.js';
const $=id=>document.getElementById(id);
let events=[],selected=null,approval=null,busy=false,session=0,reviewGeneration=0,snapshot=null,historyLimit=20;
const json=value=>JSON.stringify(value,null,2);
async function api(path,body){const startedSession=session;const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+$('token').value,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(startedSession!==session)throw Error('Token changed; unlock inbox to inspect any pending operation.');if(!response.ok){const error=Error(data.error);error.rejected=response.status<500;throw error;}return data;}
function cancel() {reviewGeneration++;approval=null;$('review').hidden=true;$('confirm').value='';}
async function action(fn){if(busy)return;busy=true;$('workbench').setAttribute('aria-busy','true');$('status').textContent='Working…';try{await fn();$('status').textContent='Ready';}catch(e){$('status').textContent=e.message;}finally{busy=false;$('workbench').setAttribute('aria-busy','false');}}
function choose(id){cancel();selected=id;const event=events.find(e=>e.id===id);$('selected').textContent=event?event.label+' • '+new Date(event.createdAt).toLocaleString():'Select an event';$('detail').textContent=event?json(event):'No event selected.';$('export').disabled=$('delete').disabled=!event;render();renderEventAttempts();}
function filteredEvents() {const query=$('eventSearch').value.trim().toLowerCase();return events.filter(e=>[e.label,e.id,e.payload?.type].some(value=>String(value||'').toLowerCase().includes(query)));}
function render(){
  $('eventCount').textContent=String(events.length);
  const inbox=$('events');inbox.replaceChildren();
  const visible=filteredEvents();
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
    $('freshness').textContent='Updated '+new Date(data.serverTime).toLocaleString()+' · Manual refresh';
  } catch(error) { if(snapshot)$('freshness').textContent='Refresh failed. Displaying an older snapshot; do not treat these counts as current.';throw error; }
}
$('connect').onclick=()=>action(refresh);
$('token').oninput=()=>{clearFixture();$('fixtureInput').value='';session++;events=[];snapshot=null;historyLimit=20;choose(null);renderDashboard();$('refresh').disabled=true;$('freshness').textContent='Locked. Unlock to load actual captured records.';$('detail').textContent='Locked';$('storage').textContent='Locked';$('diff').textContent='No comparison yet.';$('result').textContent='No replay result in this session.';$('target').replaceChildren(new Option('Unlock to load destinations',''));$('status').textContent='Token changed; unlock inbox';};
let pendingFixture=null,fixtureGeneration=0;
function clearFixture() {fixtureGeneration++;pendingFixture=null;$('fixtureReview').hidden=true;$('fixturePreview').textContent='';}
$('fixtureInput').oninput=clearFixture;
$('cancelFixture').onclick=clearFixture;
$('previewFixture').onclick=()=>action(async()=>{
  clearFixture();const generation=fixtureGeneration,fixture=JSON.parse($('fixtureInput').value);
  const collection=fixture.kind==='webhook-fixture-collection';
  const body=collection?{collection:fixture}:{fixture};
  const route=collection?'collections':'fixtures';
  const preview=await api(route+'/preview',body);
  if(generation!==fixtureGeneration)return;
  pendingFixture={route,body:{...body,confirmHash:preview.sha256}};$('fixturePreview').textContent=json(collection?preview.collection:preview.payload);
  $('fixtureNotice').textContent=(preview.redacted?'Additional fields were redacted. ':'')+'Review free text. Import creates a local event; it does not send a webhook. SHA-256: '+preview.sha256;
  $('fixtureReview').hidden=false;
});
$('importFixture').onclick=()=>action(async()=>{
  if(!pendingFixture)throw Error('Validate and review a fixture first');
  const request=pendingFixture;clearFixture();
  const result=await api(request.route+'/import',request.body);$('fixtureInput').value='';await refresh();choose(result.id||result.events[0].id);
});
$('capture').onclick=()=>action(async()=>{const event=await api('events',{label:$('label').value,payload:JSON.parse($('payload').value)});await refresh();choose(event.id);});
$('sample').onclick=()=>{$('label').value='Synthetic order';$('payload').value=json({type:'order.created',order:{id:'demo-001',amount:1499,currency:'THB'},email:'demo@example.test',token:'synthetic-secret'});};
$('export').onclick=()=>action(async()=>{const fixture=await api('events/'+selected+'/fixture');const url=URL.createObjectURL(new Blob([JSON.stringify(fixture)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='webhook-fixture-'+selected+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('exportCollection').onclick=()=>action(async()=>{
  const ids=filteredEvents().map(event=>event.id);if(ids.length<1||ids.length>20)throw Error('Filter the inbox to 1–20 events before exporting');
  const collection=await api('collections/export',{ids});
  const url=URL.createObjectURL(new Blob([JSON.stringify(collection)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='webhook-collection.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
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
  if(!snapshot){$('bucketSize').textContent='';$('storageSummary').textContent='Storage & retention';$('activityChart').append(node('p','Unlock to see activity.','empty-state'));$('outcomeChart').append(node('p','No authenticated data loaded.','empty-state'));$('retention').textContent='History is bounded, not a complete audit log.';renderHistory();return;}
  const data=activity(events,snapshot.serverTime,Number($('timeRange').value));
  const metrics=[['Captured events',data.captures,'Selected period'],['Replay starts',data.attempts.length,'Retained attempts'],['Unknown delivery',data.counts.unknown,'Verify at receiver'],['Median response time',data.medianMs===null?'—':Math.round(data.medianMs)+' ms',data.durationCount+' timed responses']];
  for(const [title,value,hint] of metrics){const card=node('div',undefined,'metric'+(title==='Unknown delivery'&&value?' attention':''));const icon=svgNode('svg',{viewBox:'0 0 24 24',class:'metric-icon','aria-hidden':'true'});icon.append(svgNode('path',{d:title==='Captured events'?'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5':title==='Replay starts'?'M4 11a8 8 0 1 1 2 6M4 4v7h7':title==='Unknown delivery'?'M12 3 2 21h20L12 3zM12 9v5M12 17v1':'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7v6l4 2'}));card.append(icon);card.append(node('span',title),node('strong',String(value)),node('small',hint));if(title==='Unknown delivery'&&value){const inspect=node('button','Inspect →','metric-link');inspect.onclick=()=>{$('outcomeFilter').value='unknown';$('historySearch').value='';historyLimit=20;renderHistory();showView('history');$('historySearch').focus();};card.append(inspect);}$('metrics').append(card);}
  $('retention').textContent=(snapshot.persistent?'Encrypted persistent storage: retained history survives a restart.':'Memory-only storage: all history is lost on restart.')+' Events expire '+snapshot.retentionHours+' hours after capture; up to '+snapshot.maxEvents+' events and '+snapshot.maxAttemptsPerEvent+' most recent attempts per event. Deletion, expiry and attempt caps remove records from all views. Not a full audit log. Includes synthetic samples if you capture them.';
  $('storageSummary').textContent=(snapshot.persistent?'Encrypted storage':'Memory only')+' · '+snapshot.retentionHours+'h retention · Limits';
  $('bucketSize').textContent=Number($('timeRange').value)===24?'2-hour intervals':'5-minute intervals';
  renderActivityChart(data);
  const total=data.attempts.length,maximum=Math.max(1,total);
  const header=node('div',undefined,'distribution-total');header.append(node('strong',String(total)),node('span','retained attempts'));$('outcomeChart').append(header);
  const strip=svgNode('svg',{viewBox:'0 0 100 12',class:'outcome-strip','aria-hidden':'true',preserveAspectRatio:'none'});strip.append(svgNode('rect',{width:100,height:12,rx:3,class:'outcome-track'}));let offset=0;
  for(const [key] of outcomes){const width=100*data.counts[key]/maximum;if(width){strip.append(svgNode('rect',{x:offset,width,height:12,class:'segment-'+key}));offset+=width;}}
  $('outcomeChart').append(strip);
  for(const [key,label] of outcomes){const count=data.counts[key],row=node('div',undefined,'outcome-row');row.dataset.outcome=key;const text=node('span',label);text.prepend(node('i',undefined,'outcome-dot segment-'+key));row.append(text,node('strong',String(count)),node('small',total?Math.round(100*count/total)+'%':'—'));$('outcomeChart').append(row);}
  renderHistory();
}
function renderActivityChart(data){
  const maximum=Math.max(1,...data.buckets.flatMap(b=>[b.captures,b.attempts]));
  for(const [key,label,css] of [['captures','Captures','captures'],['attempts','Replay starts','attempts']]){
    const section=node('div',undefined,'series '+css),heading=node('div',undefined,'series-heading');heading.append(node('span',label),node('strong',String(key==='captures'?data.captures:data.attempts.length)));section.append(heading);
    const svg=svgNode('svg',{viewBox:'0 0 600 100',class:'series-svg',role:'img','aria-label':label+' per interval. Exact values in Data table.'});
    for(const y of [15,75])svg.append(svgNode('line',{x1:28,x2:588,y1:y,y2:y,class:'chart-axis'}));
    for(const [value,y] of [[maximum,19],[0,79]]){const tick=svgNode('text',{x:0,y,class:'chart-label'});tick.textContent=String(value);svg.append(tick);}
    const points=data.buckets.map((bucket,i)=>[30+i*50,75-60*bucket[key]/maximum]);
    const line=points.map(([x,y],i)=>(i?'L':'M')+x+','+y).join(' ');
    svg.append(svgNode('path',{d:line+' L580,75 L30,75 Z',class:'series-area'}),svgNode('path',{d:line,class:'series-line'}));
    points.forEach(([x,y],i)=>{if(!data.buckets[i][key])return;const dot=svgNode('circle',{cx:x,cy:y,r:3,class:'series-dot'}),title=svgNode('title');title.textContent=dateText(data.buckets[i].start)+' – '+dateText(data.buckets[i].end)+': '+data.buckets[i][key]+' '+label;dot.append(title);svg.append(dot);});
    section.append(svg);$('activityChart').append(section);
  }
  const axis=node('div',undefined,'chart-times');
  for(const at of [data.start,data.start+(data.end-data.start)/2,data.end])axis.append(node('span',new Date(at).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})));
  $('activityChart').append(axis);
  if(!data.captures&&!data.attempts.length)$('activityChart').append(node('p','No activity in this period.','hint'));
  const table=node('table'),caption=node('caption','Local time. Each interval excludes its start and includes its end.');table.append(caption);
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
function showView(name,writeHistory=true){clearFixture();if(writeHistory&&location.hash!=='#'+name)history.pushState(null,'','#'+name);for(const view of views){const active=view===name;$('view-'+view).hidden=!active;$('tab-'+view).setAttribute('aria-selected',String(active));$('tab-'+view).tabIndex=active?0:-1;}cancel();}
for(const view of views){$('tab-'+view).onclick=()=>showView(view);$('tab-'+view).onkeydown=event=>{let index=views.indexOf(view);if(event.key==='ArrowRight')index=(index+1)%views.length;else if(event.key==='ArrowLeft')index=(index+views.length-1)%views.length;else if(event.key==='Home')index=0;else if(event.key==='End')index=views.length-1;else return;event.preventDefault();showView(views[index]);$('tab-'+views[index]).focus();};}

addEventListener('popstate',()=>showView(views.includes(location.hash.slice(1))?location.hash.slice(1):'overview',false));
showView(views.includes(location.hash.slice(1))?location.hash.slice(1):'overview',false);
