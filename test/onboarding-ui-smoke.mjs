import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLab} from '../src/server.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const token='synthetic-onboarding-admin-token-0000';let clock=Date.now();
const server=createLab({token,now:()=>clock});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
let browser;
try {
 browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 await page.goto(base);await page.locator('#token').fill(token);await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready');
 await page.locator('#startGuide').click();assert.equal(await page.locator('#payload').evaluate(el=>el===document.activeElement),true);assert.match(await page.locator('#guideProgress').innerText(),/^0 of 5/);
 await page.locator('#previewRedaction').click();await page.locator('#redactionReview').waitFor({state:'visible'});assert.match(await page.locator('#guideProgress').innerText(),/^1 of 5/);assert.equal(await page.locator('.event').count(),0);
 await page.locator('#capture').dblclick();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Ready'&&document.querySelectorAll('.event').length===1);assert.match(await page.locator('#guideProgress').innerText(),/^2 of 5/);
 const downloadPromise=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadPromise;const fixture=readFileSync(await download.path(),'utf8');assert.doesNotMatch(fixture,/synthetic-secret|demo@example.test/);assert.match(await page.locator('#guideProgress').innerText(),/^3 of 5/);
 await page.locator('.fixture-import summary').click();await page.locator('#fixtureInput').fill(fixture);await page.locator('#previewFixture').click();await page.locator('#fixtureReview').waitFor({state:'visible'});assert.match(await page.locator('#guideProgress').innerText(),/^3 of 5/);await page.locator('#importFixture').click();await page.waitForFunction(()=>document.querySelectorAll('.event').length===2&&document.querySelector('#status').textContent==='Ready');assert.match(await page.locator('#guideProgress').innerText(),/^4 of 5/);
 await page.locator('#compareWith').selectOption({index:1});await page.locator('#compare').click();await page.waitForFunction(()=>document.querySelector('#guideProgress').textContent.startsWith('5 of 5'));assert.equal(await page.locator('#result').innerText(),'No replay result in this session.');
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 // Retention expiry removes selection/export and does not imply any replay.
 clock+=24*60*60*1000+1;await page.locator('#connect').click();await page.waitForFunction(()=>document.querySelectorAll('.event').length===0&&document.querySelector('#status').textContent==='Ready');assert.equal(await page.locator('#export').isDisabled(),true);assert.match(await page.locator('#events').innerText(),/No events yet/);
 await page.locator('#token').fill('changed');assert.match(await page.locator('#guideProgress').innerText(),/^0 of 5/);assert.match(await page.locator('#guide-preview').innerText(),/^Preview redaction/);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 await page.reload();assert.match(await page.locator('#guideProgress').innerText(),/^0 of 5/);assert.equal(await page.locator('#token').inputValue(),'');assert.deepEqual(errors,[]);
 console.log('PASS onboarding: session checklist, preview without capture, duplicate capture, sanitized fixture download/import/compare, 320/390/1440 layout, retention expiry, token/reload reset; no external requests');
}finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
