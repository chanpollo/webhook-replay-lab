// Optional browser check: PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test/ui-smoke.mjs
import assert from 'node:assert/strict';
import {createLab} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const token='synthetic-browser-test-token-000000000000';
let clock=Date.now(),sendCount=0;const target='https://synthetic.example.test/hook';
const server=createLab({token,allowlist:[target],now:()=>clock,resolve:async()=>({}),send:async()=>{sendCount++;return{status:202};}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});
 const base='http://127.0.0.1:'+server.address().port;
 await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base);await page.locator('#token').fill(token);await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
 await page.locator('#capture').dblclick();await page.waitForFunction(()=>document.querySelectorAll('.event').length===1);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
 assert.match(await page.locator('#detail').innerText(),/REDACTED/);assert.doesNotMatch(await page.locator('#detail').innerText(),/synthetic-secret/);
 await page.locator('#label').fill('Synthetic revision');await page.locator('#payload').fill('{"type":"order.created","order":{"id":"demo-001","amount":1799,"currency":"THB"}}');await page.locator('#capture').click();await page.waitForFunction(()=>document.querySelectorAll('.event').length===2);
 await page.locator('#compareWith').selectOption({index:1});await page.locator('#compare').click();await page.waitForFunction(()=>document.querySelector('#diff').textContent.includes('amount'));
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/webhook-fixture-/);
 await page.screenshot({path:'docs/desktop-preview.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'docs/mobile-preview.png',fullPage:true});
 await page.locator('#target').selectOption(target);await page.locator('#prepare').click();await page.locator('#review').waitFor({state:'visible'});await page.locator('#cancel').click();assert.equal(await page.locator('#review').isVisible(),false);assert.equal(sendCount,0);
 await page.locator('#prepare').click();await page.locator('#review').waitFor({state:'visible'});clock+=60001;await page.locator('#confirm').fill('SEND TO STAGING');await page.locator('#send').click();await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('Server rejected request'));assert.equal(sendCount,0);
 await page.locator('#prepare').click();await page.locator('#review').waitFor({state:'visible'});await page.locator('#confirm').fill('SEND TO STAGING');await page.locator('#send').dblclick();await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('response_received'));assert.equal(sendCount,1);
 await page.locator('#target').selectOption(target);await page.locator('#prepare').click();await page.locator('#review').waitFor({state:'visible'});await page.route('**/api/replay',route=>route.abort());await page.locator('#confirm').fill('SEND TO STAGING');await page.locator('#send').click();await page.waitForFunction(()=>document.querySelector('#result').textContent.includes('Delivery may be unknown'));assert.equal(sendCount,1);
 await page.reload();assert.equal(await page.locator('#review').isVisible(),false);await page.locator('#token').fill(token);await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelectorAll('.event').length===2);await page.locator('.event').first().click();
 await page.locator('#delete').click();await page.waitForFunction(()=>document.querySelectorAll('.event').length===1);
 await page.locator('#token').fill('wrong');assert.equal(await page.locator('.event').count(),0);await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('valid bearer token'));
 assert.deepEqual(errors,[]);console.log('PASS browser: unlock, duplicate-click capture, redaction, comparison, export, deletion, token change, responsive layout, replay cancellation/expiry/double-click/connection interruption/reload; injected transport only, no external requests');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
