// Reproducible synthetic capacity check; not a remote-service or competitor benchmark.
import assert from 'node:assert/strict';
import {createLab} from '../src/server.js';
import {activity,filterAttempts} from '../src/analytics.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const now=Date.now(),token='synthetic-performance-token-00000000';
const events=Array.from({length:200},(_,e)=>({id:'event-'+e,label:'Synthetic event '+e,createdAt:now-3600000,payload:{type:'test.event'},attempts:Array.from({length:20},(_,a)=>({id:'attempt-'+e+'-'+a,at:now-a*60000,url:'https://synthetic.example.test/hook',outcome:a%3===0?'unknown_delivery':'response_received',status:202,durationMs:100+a}))}));
const times=[];for(let i=0;i<110;i++){const start=performance.now();const result=activity(events,now);filterAttempts(result.attempts,'synthetic','unknown');if(i>=10)times.push(performance.now()-start);}
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
const store={load:()=>({version:1,events,receipts:[]}),save(){},close(){}};
const server=createLab({token,store,now:()=>now});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const page=await browser.newPage({viewport:{width:1440,height:900}}),base='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await page.goto(base);await page.locator('#token').fill(token);await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');await page.locator('#tab-history').click();assert.equal(await page.locator('#history .attempt-card').count(),20);
 const browserTimes=await page.evaluate(()=>{const times=[],input=document.querySelector('#historySearch');for(let i=0;i<55;i++){const start=performance.now();input.value=i%2?'event 12':'synthetic';input.dispatchEvent(new Event('input'));document.querySelector('#history').getBoundingClientRect();if(i>=5)times.push(performance.now()-start);}return times;});
 await page.locator('#historySearch').fill('synthetic');await page.locator('#moreHistory').click();assert.equal(await page.locator('#history .attempt-card').count(),40);
 console.log(JSON.stringify({fixture:{events:200,attempts:4000,initialVisibleAttempts:20},node:process.version,platform:process.platform,aggregationAndFilterMs:{median:percentile(times,.5),p95:percentile(times,.95),samples:100},browserSynchronousFilterAndLayoutMs:{median:percentile(browserTimes,.5),p95:percentile(browserTimes,.95),samples:50},scope:'Local synthetic bounded metadata. Excludes network, receiver latency, max-size payloads and browser paint. No competitor comparison.'},null,2));
}finally{await browser?.close();await new Promise(r=>server.close(r));}
