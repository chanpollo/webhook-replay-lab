import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,unlinkSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createStore} from '../src/store.js';
import {createLab} from '../src/server.js';
const key='ab'.repeat(32),token='synthetic-fault-admin-token-00000000';
for(const phase of ['partial-temp','synced-temp','renamed','directory-sync-error'])test('crash/commit fault at '+phase+' preserves an authenticated complete generation',t=>{
 const directory=realpathSync(mkdtempSync(join(tmpdir(),'hook-fault-')));t.after(()=>rmSync(directory,{recursive:true,force:true}));const path=join(directory,'inbox.enc');const initial=createStore({path,key});initial.save({generation:'old'});initial.close();
 const script=`import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
 const phase=${JSON.stringify(phase)};let tempWritten=false;const write=fs.writeFileSync, sync=fs.fsyncSync, rename=fs.renameSync;
 fs.writeFileSync=(fd,data,...args)=>{if(typeof data!=='string'){tempWritten=true;if(phase==='partial-temp'){write(fd,data.subarray(0,10));process.kill(process.pid,'SIGKILL');}}return write(fd,data,...args);};
 fs.fsyncSync=fd=>{if(tempWritten&&phase==='synced-temp'){sync(fd);process.kill(process.pid,'SIGKILL');}if(tempWritten&&phase==='directory-sync-error'&&fs.fstatSync(fd).isDirectory())throw Error('synthetic fsync failure');return sync(fd);};
 fs.renameSync=(...args)=>{rename(...args);if(phase==='renamed')process.kill(process.pid,'SIGKILL');};syncBuiltinESMExports();
 const {createStore}=await import(${JSON.stringify(pathToFileURL(join(process.cwd(),'src/store.js')).href)});const store=createStore({path:${JSON.stringify(path)},key:${JSON.stringify(key)}});store.save({generation:'new'});`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'});if(phase==='directory-sync-error'){assert.equal(result.status,1);assert.match(result.stderr,/commit failed/);}else assert.equal(result.signal,'SIGKILL');
 assert.throws(()=>createStore({path,key}),/locked/);const lock=JSON.parse(readFileSync(path+'.lock'));assert.ok(lock.pid>0); // Child has exited; only now may this test remove its stale lock.
 unlinkSync(path+'.lock');const recovered=createStore({path,key});assert.deepEqual(recovered.load(),{generation:['renamed','directory-sync-error'].includes(phase)?'new':'old'});recovered.close();
});

for(const failedCommit of [2,3,4])test('replay commit failure '+failedCommit+' fails closed and restart recovers durable outcome',async t=>{
 let state=null,writes=0,sends=0;const store={load:()=>structuredClone(state),save(value){if(++writes===failedCommit)throw Error('synthetic-disk-error');state=structuredClone(value);},close(){}};
 const options={token,allowlist:['https://staging.example.test/hook'],store,resolve:async()=>({}),send:async()=>{sends++;return {status:204};}};
 let server=createLab(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));let base='http://127.0.0.1:'+server.address().port;
 const request=async(path,body)=>{const r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};};
 const captured=await request('events',{payload:{synthetic:true}});const prepared=await request('prepare',{id:captured.data.id,url:options.allowlist[0]});assert.equal((await request('replay',{nonce:prepared.data.nonce,confirm:'SEND TO STAGING'})).status,503);assert.equal((await request('events')).status,503);assert.equal(sends,failedCommit===4?1:0);
 server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=createLab(options);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 const restored=await request('events');assert.equal(restored.status,200);assert.equal(restored.data.events[0].attempts.length,failedCommit===2?0:1);if(failedCommit!==2)assert.equal(restored.data.events[0].attempts[0].outcome,failedCommit===4?'unknown_delivery':'blocked');assert.equal(sends,failedCommit===4?1:0);
});
