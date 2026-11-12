import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createLab} from '../src/server.js';
import {digest} from '../src/core.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const token='synthetic-fixture-ui-token-000000000';
const server=createLab({token});let browser;
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const payload={id:'synthetic-import',secret:'do-not-retain'};
const fixture=JSON.stringify({version:1,payload,sha256:digest(payload)});
try {
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
 const page=await browser.newPage();await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base);
 await page.locator('#token').fill(token);await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
 await page.locator('#tab-workbench').click();await page.locator('.fixture-import summary').click();
 await page.locator('#fixtureInput').fill(fixture);await page.locator('#previewFixture').click();await page.locator('#fixtureReview').waitFor({state:'visible'});
 assert.match(await page.locator('#fixturePreview').innerText(),/REDACTED/);assert.doesNotMatch(await page.locator('#fixturePreview').innerText(),/do-not-retain/);assert.equal(await page.locator('.event').count(),0);
 await page.screenshot({path:'docs/fixture-preview.png',fullPage:true});
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1050});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.locator('#tab-overview').click();await page.goBack();assert.equal(await page.locator('#fixtureReview').isVisible(),false);await page.locator('#previewFixture').click();await page.locator('#fixtureReview').waitFor({state:'visible'});
 await page.locator('#cancelFixture').click();assert.equal(await page.locator('#fixtureReview').isVisible(),false);
 await page.locator('#previewFixture').click();await page.locator('#fixtureReview').waitFor({state:'visible'});
 await page.locator('#fixtureInput').fill('{}');assert.equal(await page.locator('#fixtureReview').isVisible(),false);
 await page.locator('#previewFixture').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('version 1'));assert.equal(await page.locator('.event').count(),0);
 await page.locator('#fixtureInput').fill(fixture);await page.locator('#previewFixture').click();await page.locator('#fixtureReview').waitFor({state:'visible'});
 await page.locator('#importFixture').dblclick();await page.waitForFunction(()=>document.querySelectorAll('.event').length===1);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');assert.equal(await page.locator('#fixtureInput').inputValue(),'');
 const collection={kind:'webhook-fixture-collection',version:1,name:'Synthetic pair',fixtures:[{name:'one',fixture:JSON.parse(fixture)},{name:'two',fixture:JSON.parse(fixture)}]};
 await page.locator('#fixtureInput').fill(JSON.stringify(collection));await page.locator('#previewFixture').click();await page.locator('#fixtureReview').waitFor({state:'visible'});assert.match(await page.locator('#fixturePreview').innerText(),/Synthetic pair/);
 await page.locator('#importFixture').click();await page.waitForFunction(()=>document.querySelectorAll('.event').length===3);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
 const download=page.waitForEvent('download');await page.locator('#exportCollection').click();const savedCollection=await download;assert.equal(savedCollection.suggestedFilename(),'webhook-collection.json');assert.equal(JSON.parse(execFileSync(process.execPath,['bin/fixtures.mjs','verify',await savedCollection.path()],{encoding:'utf8'})).count,3);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
 // Late preview must not return after the operator cancels it or changes session.
 let release,seen;const gate=new Promise(r=>release=r),ready=new Promise(r=>seen=r);
 await page.route('**/api/fixtures/preview',async route=>{const response=await route.fetch();seen();await gate;await route.fulfill({response});});
 await page.locator('#fixtureInput').fill(fixture);await page.locator('#previewFixture').click();await ready;
 await page.locator('#fixtureInput').fill('{}');release();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');assert.equal(await page.locator('#fixtureReview').isVisible(),false);
 await page.unroute('**/api/fixtures/preview');await page.locator('#fixtureInput').fill(fixture);await page.locator('#previewFixture').click();await page.locator('#fixtureReview').waitFor({state:'visible'});
 await page.locator('#token').fill('changed');assert.equal(await page.locator('#fixtureReview').isVisible(),false);assert.equal(await page.locator('#fixtureInput').inputValue(),'');assert.deepEqual(errors,[]);
 console.log('PASS fixture UI: preview without save, redaction, cancel, invalid version, stale preview, double-click import and session clearing');
} finally {await browser?.close();await new Promise(r=>server.close(r));}
