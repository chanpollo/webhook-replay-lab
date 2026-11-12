import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {BUILD_FILES,readBuildInfo} from '../src/build-info.js';
import {createLab} from '../src/server.js';

test('version matches package and build identifies actual runtime contents without Git', t => {
 const local=readBuildInfo();assert.equal(local.version,JSON.parse(readFileSync(new URL('../package.json',import.meta.url))).version);assert.match(local.build,/^[a-f0-9]{12}$/);
 const dir=mkdtempSync(join(tmpdir(),'lab-build-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));mkdirSync(join(dir,'src'));mkdirSync(join(dir,'bin'));const root=pathToFileURL(dir+'/');
 for(const file of BUILD_FILES)writeFileSync(new URL(file,root),readFileSync(new URL('../'+file,import.meta.url)));
 assert.deepEqual(readBuildInfo(root),local);
 writeFileSync(new URL('src/style.css',root),'/* changed source */');assert.notEqual(readBuildInfo(root).build,local.build);
});
test('missing or malformed metadata uses explicit non-fabricated fallback',t=>{
 const dir=mkdtempSync(join(tmpdir(),'lab-build-missing-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const root=pathToFileURL(dir+'/');
 assert.deepEqual(readBuildInfo(root),{version:'unknown',build:'unavailable'});
 writeFileSync(new URL('package.json',root),JSON.stringify({version:'1.2.3-beta.1+source'}));assert.deepEqual(readBuildInfo(root),{version:'1.2.3-beta.1+source',build:'unavailable'});
 writeFileSync(new URL('package.json',root),JSON.stringify({version:'<script>alert(1)</script>'}));assert.equal(readBuildInfo(root).version,'unknown');
});
test('HTML exposes accurate version/build before login without unresolved placeholders',async t=>{
 const server=createLab({token:'synthetic-build-check-token-000000000'});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const response=await fetch('http://127.0.0.1:'+server.address().port),html=await response.text(),info=readBuildInfo();assert.equal(response.status,200);assert.ok(html.includes('v'+info.version));assert.ok(html.includes('build '+info.build));assert.ok(!html.includes('__LAB_'));
});
