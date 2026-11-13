# Offline redaction migration

Use this when stricter additive rules prevent startup with existing retained payloads. Stop every writer and preserve a private encrypted source backup and its key first. The source must be a valid version-1 snapshot in a dedicated operator-owned directory. Never remove a lock merely because migration reports it.

```sh
export LAB_STORAGE_KEY_FILE=/private/secrets/storage-key
export LAB_REDACTION_PATHS_FILE=/private/config/stricter-rules.json
node bin/migrate-redaction.mjs /private/data/inbox.enc /private/data/sanitized.enc
```

The destination must not exist and must be distinct from the source. The command authenticates and validates the source, applies default redaction plus the configured rules to every payload, validates the new snapshot, writes a mode-0600 encrypted copy under the same key and authenticates/compares its contents before returning `verified:true`. It never starts a listener or sends a replay. It prints only counts and fixed flags, never payloads, keys or paths. Wrong keys, invalid rules/state, active/stale locks and existing destinations fail closed.

The copied workspace has deliberately different history:

- Event IDs, original creation times and sanitized payloads remain; expiry is not extended.
- **All labels become “Migrated capture” and all replay attempts are removed from the copy**, even for payloads that were already compliant. Historical hashes, URLs and free-text errors may reference the previous payload or contain sensitive metadata. The original encrypted snapshot retains that history for authorized investigation. Inspect uncertain deliveries there **before** choosing to replay from the copy; migration never proves a prior delivery failed.
- Ingress receipt IDs, timestamps, provider markers and raw-body hashes remain to preserve bounded duplicate/conflict handling. They are metadata and remain subject to the existing receipt window. Rules do not sanitize those identifiers/hashes.
- Unrecognized snapshot/event metadata is omitted. This command does not export or promise to preserve custom extensions.

After success, select the new path **with the same key and stricter rules**, start privately and inspect the payloads and retention. Check restart persistence. In Docker, Kubernetes or Hostinger, perform this with the service stopped as the service user and update the mounted destination path accordingly. Roll back only after stopping every writer, by selecting the original source and its matching old policy/key. Writes after cutover are absent from the source; do not merge encrypted files.

Failure can leave an incomplete or complete destination requiring inspection; it is never deleted automatically. Originals, backups and downloaded fixtures retain their prior content independently of current retention or rules. Plan their secure retirement under your own retention obligations. This migration is additive masking, not DLP or secure erasure; review rules, free text and outputs manually. Use [key rotation](STORAGE_KEY_ROTATION.md) separately if the encryption key must change.
