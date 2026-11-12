import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const temp=mkdtempSync(join(tmpdir(),'lab-hostinger-'));
const project=`lab-hostinger-test-${process.pid}`;
const env={...process.env, LAB_TOKEN:'synthetic-hostinger-test-token-000000', LAB_STORAGE_KEY:'ab'.repeat(32), STAGING_ALLOWLIST:''};
const base=['compose','--project-directory',root,'--env-file','/dev/null','-p',project,'-f',join(root,'compose.hostinger.yaml')];
const run=(args)=>execFileSync('docker',args,{env,encoding:'utf8',timeout:180000,stdio:['ignore','pipe','pipe']});
let started=false, failure, cleanup=base;
try {
  const engine=run(['version','--format','{{.Server.Version}}']).trim();
  assert.ok(Number(engine.split('.')[0])>=28,'Docker Engine 28+ required for loopback-publish isolation');
  const config=JSON.parse(run([...base,'config','--format','json']));
  const lab=config.services.lab;
  assert.equal(lab.ports.length,1);
  assert.equal(lab.ports[0].host_ip,'127.0.0.1');
  assert.equal(lab.environment.LAB_INGRESS_KEY,'');
  assert.equal(lab.environment.STAGING_ALLOWLIST,'');
  assert.equal(lab.read_only,true);
  assert.deepEqual(lab.cap_drop,['ALL']);
  assert.equal(lab.restart,'no');
  assert.equal(lab.volumes[0].type,'volume');
  // Exercise the actual profile without host ports or any outbound network.
  const override=join(temp,'isolated.yaml');
  writeFileSync(override,'services:\n  lab:\n    ports: !reset []\n    network_mode: none\nvolumes:\n  restore-data:\n');
  const isolated=[...base,'-f',override];cleanup=isolated;
  started=true;
  run([...isolated,'up','-d','--build','--wait','--wait-timeout','30']);
  const js=`
    const headers={authorization:'Bearer '+process.env.LAB_TOKEN,'content-type':'application/json'};
    const r=await fetch('http://127.0.0.1:4319/api/events',{method:'POST',headers,body:JSON.stringify({label:'Synthetic Hostinger profile test',payload:{synthetic:true,password:'redact-me'}})});
    if(r.status!==201)throw Error('capture '+r.status);
    const ingress=await fetch('http://127.0.0.1:4319/ingress',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
    if(ingress.status!==404)throw Error('ingress must be disabled: '+ingress.status);
    if(process.getuid()===0)throw Error('root user');
  `;
  run([...isolated,'exec','-T','lab','node','--input-type=module','-e',js]);
  const packages=run([...isolated,'exec','-T','lab','apk','info','-v']);assert.match(packages,/(?:^|\n)zlib-1\.4-r0(?:\n|$)/,'vendor zlib security fix required');
  run([...isolated,'stop']);
  run([...isolated,'up','-d','--wait','--wait-timeout','30']);
  run([...isolated,'exec','-T','lab','node','--input-type=module','-e',`
    const r=await fetch('http://127.0.0.1:4319/api/events',{headers:{authorization:'Bearer '+process.env.LAB_TOKEN}});
    const b=await r.json();
    if(r.status!==200||!b.persistent||b.events.length!==1||b.events[0].payload.password!=='[REDACTED]')throw Error('persistence regression');
  `]);
  // Restore an actual stopped-container backup into a separate empty named volume.
  run([...isolated,'stop']);
  const backup=join(temp,'backup.enc');
  run([...isolated,'cp','lab:/data/inbox.enc',backup]);chmodSync(backup,0o600);
  const restore=join(temp,'restore.yaml');
  writeFileSync(restore,'services:\n  lab:\n    volumes: !override\n      - restore-data:/data\n');
  const restored=[...isolated,'-f',restore];
  run([...restored,'run','--rm','--no-deps','lab','node','--input-type=module','-e',`
    import {writeFileSync} from 'node:fs';
    writeFileSync('/data/inbox.enc',Buffer.from(process.argv[1],'base64'),{mode:0o600,flag:'wx'});
  `,readFileSync(backup).toString('base64')]);
  run([...restored,'up','-d','--force-recreate','--wait','--wait-timeout','30']);
  run([...restored,'exec','-T','lab','node','--input-type=module','-e',`
    const r=await fetch('http://127.0.0.1:4319/api/events',{headers:{authorization:'Bearer '+process.env.LAB_TOKEN}});
    const b=await r.json();
    if(r.status!==200||b.events.length!==1||b.events[0].payload.password!=='[REDACTED]')throw Error('isolated backup restore regression');
  `]);
  console.log('Hostinger profile: loopback binding, hardening, non-root capture, disabled ingress, encrypted named-volume restart and separate-volume backup restoration passed. No Hostinger deployment performed.');
} catch(error) {
  failure=error;
  throw error;
} finally {
  try {
    if(started) {
      run([...cleanup,'down','--volumes','--rmi','local']);
      // Compose only removes volumes active in the current service model. The
      // restore override used a second volume, so explicitly remove this project's
      // remaining disposable volumes after its containers have been removed.
      const remaining=run(['volume','ls','--filter','label=com.docker.compose.project='+project,'--format','{{.Name}}']).trim().split(/\s+/).filter(Boolean);
      for(const name of remaining)assert.ok([project+'_lab-data',project+'_restore-data'].includes(name),'unexpected volume in disposable project');
      if(remaining.length)run(['volume','rm',...remaining]);
    }
  } catch(error) {
    if(!failure)throw error;
    console.error('Disposable Docker cleanup failed; inspect project '+project);
  } finally {
    rmSync(temp,{recursive:true,force:true});
  }
}
