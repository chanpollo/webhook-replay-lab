import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,chmodSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createCredentialPolicy,readScopedCredentials} from '../src/auth.js';
const adminToken='a'.repeat(64),captureToken='b'.repeat(64),readToken='c'.repeat(64);
const credentials=[{id:'capture-client',scope:'capture',token:captureToken},{id:'observer',scope:'read',token:readToken}];
const policy=()=>createCredentialPolicy({adminToken,credentials});
test('scoped auth uses exact bearer and returns no token/digest',()=>{
 const p=policy();assert.deepEqual(p.authenticate('Bearer '+adminToken),{id:'admin',scope:'admin'});assert.deepEqual(p.authenticate('Bearer '+captureToken),{id:'capture-client',scope:'capture'});assert.deepEqual(p.authenticate('Bearer '+readToken),{id:'observer',scope:'read'});
 for(const header of [undefined,adminToken,'bearer '+adminToken,'Bearer '+adminToken+' ','Bearer '+adminToken+'x','Bearer '+('z'.repeat(64)),'Bearer '+('a'.repeat(300))])assert.equal(p.authenticate(header),null);
});
test('capture can append only; read cannot mutate or prepare/send',()=>{
 const p=policy(),capture=p.authenticate('Bearer '+captureToken),read=p.authenticate('Bearer '+readToken);
 assert.equal(p.allows(capture,'POST','/api/events'),true);
 for(const [method,path] of [['GET','/api/events'],['GET','/api/events/abc/fixture'],['POST','/api/prepare'],['POST','/api/replay'],['POST','/api/delete'],['POST','/api/fixtures/import'],['POST','/api/collections/import'],['POST','/api/collections/export'],['POST','/api/compare'],['POST','/ingress']])assert.equal(p.allows(capture,method,path),false,path);
 for(const [method,path] of [['GET','/api/events'],['GET','/api/events/abc-123/fixture'],['POST','/api/compare'],['POST','/api/collections/export']])assert.equal(p.allows(read,method,path),true,path);
 for(const path of ['/api/events','/api/prepare','/api/replay','/api/delete','/api/fixtures/import','/api/collections/import','/api/redaction/preview','/ingress'])assert.equal(p.allows(read,'POST',path),false,path);
 for(const path of ['/api/events?x=1','/api/events/../fixture','/api/events/a/fixture/','/api/events/a%2fb/fixture'])assert.equal(p.allows(read,'GET',path),false,path);
 assert.equal(p.allows(null,'GET','/api/events'),false);
});
test('credential config fails closed without echoing secrets',()=>{
 for(const list of [[{id:'admin',scope:'read',token:readToken}],[{id:'x',scope:'admin',token:readToken}],[{id:'x',scope:'read',token:adminToken}],[credentials[0],credentials[0]],[{...credentials[0],extra:true}],[{...credentials[0],token:'short'}],Array(17).fill(credentials[0]),{}])assert.throws(()=>createCredentialPolicy({adminToken,credentials:list}),e=>!e.message.includes(readToken)&&!e.message.includes(adminToken));
});
test('private file loading and restart rotation reject old credentials',t=>{
 const dir=mkdtempSync(join(tmpdir(),'hook-auth-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'tokens.json');
 writeFileSync(path,JSON.stringify(credentials),{mode:0o600});const before=createCredentialPolicy({adminToken,credentials:readScopedCredentials(path)});
 const rotated=[{...credentials[0],token:'d'.repeat(64)},credentials[1]];writeFileSync(path,JSON.stringify(rotated));const after=createCredentialPolicy({adminToken,credentials:readScopedCredentials(path)});
 assert.ok(before.authenticate('Bearer '+captureToken));assert.equal(after.authenticate('Bearer '+captureToken),null);assert.ok(after.authenticate('Bearer '+'d'.repeat(64)));assert.ok(after.authenticate('Bearer '+readToken));
 chmodSync(path,0o644);assert.throws(()=>readScopedCredentials(path),/private/);chmodSync(path,0o600);symlinkSync(path,join(dir,'link'));assert.throws(()=>readScopedCredentials(join(dir,'link')),/private/);writeFileSync(path,'x'.repeat(16385));assert.throws(()=>readScopedCredentials(path),/16 KB/);assert.throws(()=>readScopedCredentials(dir),/regular/);
});

test('credential FIFO is rejected without waiting for a writer',t=>{
 const dir=mkdtempSync(join(tmpdir(),'hook-auth-fifo-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));const path=join(dir,'fifo');execFileSync('mkfifo',[path]);assert.throws(()=>readScopedCredentials(path),/regular/);
});
