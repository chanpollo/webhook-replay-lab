# Offline storage-key rotation

This command copies an authenticated version-1 snapshot into a **new** encrypted file under a different key. It does not replace the source, start a server, send requests, remove stale locks, prune records or change redaction policy. Use a dedicated directory owned by the service user, not writable by other users. Both snapshot files remain mode 0600. Run as that same user, including inside containers.

1. Stop Hook gracefully and verify every writer is stopped. For Kubernetes, scale the deployment to zero and wait for the pod to terminate. For Compose, stop the service. Keep ingress stopped until verification is complete.
2. Preserve a private backup of the original snapshot and its old key. A backup without its key cannot be restored. Never delete a lock until independently verifying no writer is alive.
3. Generate a different 32-byte hex key into a new private file (umask 077). Keep keys out of command arguments, shell history and shared logs. Point these variables at existing private secret files; do not paste their values:

```sh
export LAB_STORAGE_KEY_FILE=/private/secrets/current-storage-key
export LAB_NEW_STORAGE_KEY_FILE=/private/secrets/new-storage-key
node bin/rotate-storage-key.mjs /private/data/inbox.enc /private/data/rotated.enc
```

The destination must not exist. Direct key variables and corresponding `_FILE` variables are mutually exclusive. The command prints only a verification flag and record counts. Failure prints a fixed message without paths, keys or snapshot content. Do not enable shell tracing.

4. A successful result has `verified:true`: the tool decrypted and validated the source, wrote the destination, then authenticated and compared its decrypted contents. Original source bytes, event timestamps, replay history and ingress deduplication receipts remain unchanged. In-flight replay records remain unchanged in the copy; normal startup recovers a sending attempt as unknown delivery. Rotation never means it is safe to resend.
5. Configure the stopped service with the **new destination path and new key together**, then start it privately. Check health, unlock the inbox, compare retained events and inspect uncertain attempts. Check restart persistence. Apply the same path/key pairing in Docker, Kubernetes Secret/volume configuration or the Hostinger VPS profile. Do not put either key in an image, manifest committed to Git, or fixture export.
6. Roll back by stopping all writers and selecting the preserved source path with its old key. Writes made after cutover are absent from the old copy; reconcile deliberately rather than merge files. Old backups retain their old encryption and data even after source deletion or retention expiry. Retire them and their keys according to your retention obligations after acceptance.

Wrong keys, corrupt/unsupported snapshots, an existing destination and source/destination locks fail closed. A failed write or verification can leave a destination requiring inspection; the tool never removes it automatically. Operators must preserve the original and investigate before retrying with another absent destination. Exclusive locks coordinate Hook writers; directories with untrusted concurrent filesystem writers are unsupported.

This is key rotation only. It does not sanitize historical payloads, labels or attempts. Follow [redaction migration guidance](REDACTION.md) for a stricter redaction policy. It does not rotate admin, ingress or Stripe credentials. The tests exercise a local encrypted copy and startup recovery; actual Docker, Kubernetes and Hostinger operator cutover still requires per-route acceptance.
