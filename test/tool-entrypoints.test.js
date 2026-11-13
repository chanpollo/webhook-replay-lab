import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
test('release-tool path aliases still execute CLI validation instead of silently succeeding as imports',t=>{const dir=fs.mkdtempSync(join(tmpdir(),'hook-cli-alias-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));for(const name of ['verify-image-archive.mjs','retain-image-security.mjs','prepare-release-packet.mjs','collect-ci-evidence.mjs']){const alias=join(dir,name);fs.symlinkSync(resolve('scripts',name),alias);const run=spawnSync(process.execPath,[alias],{encoding:'utf8'});assert.equal(run.status,1,name);assert.notEqual(run.stderr.trim(),'',name);}});
