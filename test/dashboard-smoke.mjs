// Synthetic local data and injected transport only. No external requests.
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLab} from '../src/server.js';
import {createStore} from '../src/store.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const token='synthetic-dashboard-test-token-0000000',target='https://synthetic.example.test/hook';
const dir=mkdtempSync(join(tmpdir(),'lab-dashboard-')),path=join(dir,'events.enc'),key='ab'.repeat(32);
let clock=Date.now()-22*3600000,mode=0,server,browser;
async function start(){server=createLab({token,allowlist:[target],store:createStore({path,key}),now:()=>clock,resolve:async()=>{if(mode===3)throw Error('Synthetic DNS policy denial');return{};},send:async()=>{if(mode===2)throw Error('Synthetic connection interrupted');return{status:mode===1?500:202,durationMs:mode===1?480:124};}});await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;}
async function stop(){await new Promise(r=>server.close(r));server=null;}
try{
 let base=await start();
 const api=async(route,body)=>{const response=await fetch(base+'/api/'+route,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.ok(response.ok);return response.json();};
 for(mode=0;mode<4;mode++){
   const event=await api('events',{label:['Synthetic order accepted','Synthetic receiver error','Synthetic interrupted delivery','Synthetic blocked destination'][mode],payload:{type:'order.created',order:{id:'demo-'+mode,amount:1499},email:'demo@example.test'}});
   const approval=await api('prepare',{id:event.id,url:target});await api('replay',{nonce:approval.nonce,confirm:'SEND TO STAGING'});clock+=6*3600000;
 }
 // Stay within 24 hours of the oldest capture, then verify encrypted restart.
 clock-=3*3600000;const before=await api('events');await stop();base=await start();const restored=await api('events');assert.deepEqual(restored.events,before.events);assert.equal(restored.persistent,true);assert.equal(restored.maxAttemptsPerEvent,20);
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 await page.goto(base);assert.match(await page.locator('#activityChart').innerText(),/Unlock/);
 await page.locator('#token').fill(token);await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
 assert.deepEqual(await page.locator('.metric strong').allTextContents(),['4','4','1','302 ms']);assert.match(await page.locator('#retention').innerText(),/survives a restart/);assert.equal(await page.locator('#chartData tbody tr').count(),12);
 await page.locator('.metric-link').click();assert.equal(await page.locator('#historySearch').evaluate(el=>el===document.activeElement),true);await page.locator('#tab-overview').click();await page.locator('#tab-overview').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-history').getAttribute('aria-selected'),'true');await page.locator('#outcomeFilter').selectOption('all');assert.equal(await page.locator('#history .attempt-card').count(),4);
 await page.locator('#outcomeFilter').selectOption('unknown');assert.equal(await page.locator('#history .attempt-card').count(),1);assert.match(await page.locator('#history').innerText(),/Check receiver logs/);
 await page.locator('#history .attempt-top button').click();assert.equal(await page.locator('#view-workbench').isVisible(),true);assert.match(await page.locator('#eventAttempts').innerText(),/Unknown delivery/);assert.match(await page.locator('#detail').innerText(),/REDACTED/);
 await page.locator('#eventSearch').fill('blocked');assert.equal(await page.locator('.event').count(),1);await page.locator('#eventSearch').fill('');
 await page.screenshot({path:'docs/workbench-preview.png',fullPage:true});
 await page.locator('#tab-history').click();await page.locator('#outcomeFilter').selectOption('all');await page.locator('#historySearch').fill('no-such-event');assert.match(await page.locator('#history').innerText(),/No attempts match/);await page.locator('#historySearch').fill('');
 await page.screenshot({path:'docs/history-preview.png',fullPage:true});
 await page.locator('#tab-overview').click();await page.screenshot({path:'docs/desktop-preview.png',fullPage:true});
 for(const width of [320,390,720,1024,1440]){await page.setViewportSize({width,height:900});for(const view of ['overview','history','workbench']){await page.locator('#tab-'+view).click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow '+width+' '+view);} }
 await page.setViewportSize({width:390,height:844});await page.locator('#tab-overview').click();await page.screenshot({path:'docs/mobile-preview.png',fullPage:true});
 await page.locator('#tab-history').click();await page.goBack();assert.equal(await page.locator('#view-overview').isVisible(),true);await page.goForward();assert.equal(await page.locator('#view-history').isVisible(),true);await page.locator('#tab-overview').click();await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#timeRange').selectOption('1');assert.deepEqual(await page.locator('.metric strong').allTextContents(),['0','0','0','—']);await page.locator('#timeRange').selectOption('24');
 // A failed refresh is explicitly stale, not silently marked live.
 await page.route('**/api/events',route=>route.abort());await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('#freshness').textContent.includes('Refresh failed'));await page.unroute('**/api/events');
 // Retention changes totals after refresh; filters and browser DOM cannot retain expired data.
 clock+=4*3600000;await page.locator('#refresh').click();await page.waitForFunction(()=>document.querySelector('.metric strong').textContent==='3');
 await page.locator('#token').fill('changed');assert.equal(await page.locator('.metric').count(),0);assert.equal(await page.locator('#history .attempt-card').count(),0);assert.equal(await page.locator('#eventAttempts .attempt-card').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS dashboard: actual synthetic captures/replays, encrypted restart, exact metrics, unknown delivery drilldown, filters, chart table, keyboard tabs, failed refresh, expiry, token clearing, 320–1440 px layouts. No external network.');
}finally{await browser?.close();if(server)await stop();rmSync(dir,{recursive:true,force:true});}
