import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const image = readFileSync(new URL('../compose.image.yaml', import.meta.url), 'utf8');
const source = readFileSync(new URL('../compose.hostinger.yaml', import.meta.url), 'utf8');
const withoutComments = text => text.split('\n').filter(line => !line.trimStart().startsWith('#')).join('\n');

test('loaded-image profile mirrors hardened persistent profile except image source', () => {
  const normalized = image.replace(/^    image:.*\n    pull_policy: never/m, '    build: .');
  assert.equal(withoutComments(normalized), withoutComments(source));
});

test('loaded-image profile cannot build or pull implicitly and preserves private lifecycle', () => {
  assert.match(image, /^    image: "\$\{LAB_IMAGE:\?[^}]+\}"$/m);
  assert.match(image, /^    pull_policy: never$/m);
  assert.doesNotMatch(image, /^\s*build:/m);
  assert.doesNotMatch(image, /latest|network_mode:|privileged:|container_name:/);
  assert.deepEqual(image.match(/^\s+- "[^"\n]*:[^"\n]*"$/gm)?.map(s => s.trim()), ['- "127.0.0.1:4319:4319"']);
  assert.match(image, /^  lab:$/m);
  assert.match(image, /^      - lab-data:\/data$/m);
  assert.match(image, /^    read_only: true$/m);
  assert.match(image, /^    cap_drop: \[ALL\]$/m);
  assert.match(image, /no-new-privileges:true/);
  assert.match(image, /^    restart: "no"$/m);
  assert.match(image, /^    stop_grace_period: 15s$/m);
  assert.match(image, /^      LAB_INGRESS_KEY: ""$/m);
});
