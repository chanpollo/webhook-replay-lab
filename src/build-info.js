import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// Hash only shipped runtime inputs, never environment values, credentials or data.
export const BUILD_FILES = ['package.json', 'bin/fixtures.mjs', 'bin/doctor.mjs', 'src/analytics.js', 'src/operations.js', 'src/auth.js', 'src/secrets.js', 'src/provider-signatures.js', 'src/app.js', 'src/build-info.js', 'src/core.js', 'src/redaction.js', 'src/fixture.js', 'src/index.html', 'src/server.js', 'src/store.js', 'src/style.css'];
export function readBuildInfo(root = new URL('../', import.meta.url)) {
  let version = 'unknown';
  try {
    const value = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')).version;
    if (typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value)) version = value;
  } catch {}
  try {
    const hash = createHash('sha256');
    for (const file of BUILD_FILES) {
      const bytes = readFileSync(new URL(file, root));
      hash.update(file + '\0' + bytes.length + '\0').update(bytes);
    }
    return {version, build: hash.digest('hex').slice(0, 12)};
  } catch {
    return {version, build: 'unavailable'};
  }
}
