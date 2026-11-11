import { constants, openSync, closeSync, fstatSync, lstatSync, readSync, writeFileSync, fsyncSync, renameSync, unlinkSync, realpathSync } from 'node:fs';
import { dirname, basename, resolve, join } from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const MAX_STORE_BYTES = 32 * 1024 * 1024;
const MAGIC = Buffer.from('WRLAB001');
const OVERHEAD = MAGIC.length + 12 + 16;
const noFollow = constants.O_NOFOLLOW || 0;

function regular(stat) {
  if (!stat.isFile() || stat.nlink !== 1) throw new Error('Store must be a regular file without hard links');
  if ((stat.mode & 0o077) !== 0) throw new Error('Store files must be private (mode 0600)');
  if (process.getuid && stat.uid !== process.getuid()) throw new Error('Store must be owned by the current user');
}
function inspect(path) {
  try { const stat = lstatSync(path); regular(stat); return stat; }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Use a dedicated, operator-owned directory; sharing it with untrusted writers is unsupported.
export function createStore({path, key} = {}) {
  if (typeof path !== 'string' || !path || typeof key !== 'string' || !/^[a-fA-F0-9]{64}$/.test(key)) throw new Error('Storage requires a path and a 32-byte hex encryption key');
  const parent = realpathSync(dirname(resolve(path)));
  const directory = lstatSync(parent);
  if (!directory.isDirectory() || (directory.mode & 0o022) !== 0 || (process.getuid && directory.uid !== process.getuid())) throw new Error('Storage directory must be owned by the current user and not writable by others');
  const filename = join(parent, basename(path));
  const lockname = filename + '.lock';
  const secret = Buffer.from(key, 'hex');
  let lock, identity, closed = false, faulted = false;
  try {
    inspect(filename);
    lock = openSync(lockname, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600);
    identity = fstatSync(lock);
    writeFileSync(lock, JSON.stringify({pid:process.pid, createdAt:new Date().toISOString()}));
    fsyncSync(lock);
  } catch (error) {
    if (lock !== undefined) { closeSync(lock); try { unlinkSync(lockname); } catch {} }
    secret.fill(0);
    if (error.code === 'EEXIST') throw new Error('Storage is locked; stop the other process, or verify no writer is running before manually removing the stale .lock file');
    throw error;
  }
  function available() {
    if (closed) throw new Error('Store is closed');
    if (faulted) throw new Error('Storage write failed; restart and inspect the stored state before continuing');
    const current = lstatSync(lockname);
    if (current.dev !== identity.dev || current.ino !== identity.ino) throw new Error('Storage lock changed; stop this process');
  }
  return {
    load() {
      available();
      let fd;
      try {
        try { fd = openSync(filename, constants.O_RDONLY | noFollow); }
        catch (error) { if (error.code === 'ENOENT') return null; throw error; }
        const stat = fstatSync(fd); regular(stat);
        if (stat.size < OVERHEAD || stat.size > MAX_STORE_BYTES) throw new Error('Invalid encrypted store size');
        const bytes = Buffer.alloc(stat.size);
        let offset = 0;
        while (offset < bytes.length) { const count = readSync(fd, bytes, offset, bytes.length-offset, null); if (!count) throw new Error('Encrypted store changed during read'); offset += count; }
        if (readSync(fd, Buffer.alloc(1), 0, 1, null)) throw new Error('Encrypted store changed during read');
        if (!bytes.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('Invalid encrypted store format');
        const decipher = createDecipheriv('aes-256-gcm', secret, bytes.subarray(8,20));
        decipher.setAAD(MAGIC); decipher.setAuthTag(bytes.subarray(20,36));
        let plaintext;
        try { plaintext = Buffer.concat([decipher.update(bytes.subarray(36)), decipher.final()]); }
        catch { throw new Error('Encrypted store authentication failed: wrong key or corrupted file'); }
        try { return JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(plaintext)); }
        finally { plaintext.fill(0); }
      } catch (error) {
        faulted = true;
        throw error;
      } finally { if (fd !== undefined) closeSync(fd); }
    },
    save(state) {
      available();
      const serialized = JSON.stringify(state);
      if (typeof serialized !== 'string' || Buffer.byteLength(serialized) + OVERHEAD > MAX_STORE_BYTES) throw new Error('Snapshot exceeds the storage size limit or is not JSON');
      const plaintext = Buffer.from(serialized);
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', secret, iv);
      cipher.setAAD(MAGIC);
      let encrypted;
      try { encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]); }
      finally { plaintext.fill(0); }
      const bytes = Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
      const temporary = join(parent, '.' + basename(filename) + '.' + randomBytes(16).toString('hex') + '.tmp');
      let fd, dirfd, created = false;
      try {
        inspect(filename);
        fd = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow, 0o600); created = true;
        writeFileSync(fd, bytes); fsyncSync(fd); closeSync(fd); fd = undefined;
        inspect(filename);
        renameSync(temporary, filename); created = false;
        dirfd = openSync(parent, constants.O_RDONLY); fsyncSync(dirfd);
      } catch (error) {
        faulted = true;
        throw new Error('Storage commit failed; durable outcome may be uncertain. Stop writes and inspect after restart.', {cause:error});
      } finally {
        if (fd !== undefined) closeSync(fd);
        if (dirfd !== undefined) closeSync(dirfd);
        if (created) { try { unlinkSync(temporary); } catch {} }
      }
    },
    close() {
      if (closed) return;
      closed = true; secret.fill(0); closeSync(lock);
      const current = lstatSync(lockname);
      if (current.dev !== identity.dev || current.ino !== identity.ino) throw new Error('Storage lock changed; refusing to remove another writer’s lock');
      unlinkSync(lockname);
    }
  };
}
