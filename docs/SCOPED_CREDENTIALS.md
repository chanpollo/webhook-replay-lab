# Private scoped credentials and rotation

Optional for the existing private single-inbox workbench. Disabled unless an operator supplies configuration. This does not enable public ingress, multiple tenants, per-event ownership, SSO or user management. All readers see the same retained sanitized inbox, replay metadata and configured destination allowlist. Treat this access as confidential.

## Roles

| Credential | Allowed operations |
| --- | --- |
| Existing admin (`LAB_TOKEN` / `LAB_TOKEN_FILE`) | Existing complete private API, including redaction preview, import, delete and confirmed replay |
| `capture` | `POST /api/events` only; returns only its newly created sanitized record. Cannot list, export, import or replay |
| `read` | `GET /api/events`, `GET /api/events/:id/fixture`, `POST /api/compare`, `POST /api/collections/export`. Cannot capture, import, delete, prepare, replay or use redaction preview |

No credential may be configured as a second admin. Permissions are exact route/method matches. Unknown routes and preview routes deny scoped roles by default. Signed `/ingress` remains separately authenticated and configured; these tokens never replace its HMAC or enable it. Host/Origin restrictions, storage caps, rate limiting and replay safeguards remain in force.

## Provision

For a direct Node start, set `LAB_SCOPED_TOKENS_FILE` to a private regular JSON file readable by the application process (0600 or stricter, not a symlink, maximum 16 KB). The application reads it only at startup. Its format is an array of objects with exactly `id`, `scope`, and `token`. IDs are unique 1–40 ASCII letters/digits/underscore/hyphen; `admin` is reserved. Scopes are exactly `capture` or `read`. Maximum 16 entries. Generate independent cryptographically random tokens, e.g. 32 random bytes encoded as 64 hex characters; never use the admin token as a scoped token. Tokens must be 32–256 printable non-space ASCII characters. Duplicate tokens/IDs and unknown fields fail startup without echoing credentials.

Never commit this file, add it to images, paste it into tickets or put tokens in URLs. Provision secret values through the operator's secure storage rather than copying an illustrative sample token. In a container, explicitly mount the file read-only outside the source tree and set the variable to its container path; the file must be owned/readable by the non-root application UID. Existing Compose profiles do **not** automatically mount or forward this new optional file. Do not loosen file modes to make a failed mount work. Docker administrators already have authority to inspect container secrets.

Authorization requires an exact `Authorization: Bearer <token>` header. API errors never disclose token values or credential file paths. Comparison uses fixed-length SHA-256 digests and timing-safe equality across all configured entries. These bearer secrets still require secure transport/storage and must not be shared publicly.

## Rotate or revoke safely

1. Identify the credential ID and consumers; generate a fresh independent token in approved secret storage. Do not change the storage encryption key as part of this operation.
2. Prepare a replacement complete configuration file privately. Keep all unaffected entries exactly as intended. Replace only the target token, or remove its entry to revoke. Validate against the schema. Atomic file replacement prevents partially written configuration, but does not update a running process.
3. Stop the application gracefully and wait for in-flight operations to settle. Then replace its private configuration and restart. Never delete a live storage lock or run two writers. The startup snapshot is the authority; editing the file alone does not rotate credentials.
4. Using harmless synthetic input, verify the **old token returns 401**, the new token can perform its allowed operation, and forbidden operations still return 403. Check an unaffected reader/admin credential remains valid. Do not send a replay as a rotation check.
5. Remove the old secret from consumers and secure storage according to your policy. Restoring an old credential file would reactivate its tokens; do not accidentally restore it with a data backup.

There is no overlapping old/new key window, no online rotation endpoint and no persisted token database. A revoked caller already handling a request may finish before graceful shutdown; stop/restart is the revocation boundary. Admin rotation remains changing `LAB_TOKEN`/file and restarting. Ingress-key rotation is separate and has no overlap window. Encryption-key migration remains unimplemented.

Each authenticated credential ID has a separate 120-request/minute budget, with at most 17 bounded entries including admin. Capture can still fill the shared 200-event inbox; scoped credentials are trusted integration collaborators, not hostile tenant isolation. Unauthenticated requests retain the global budget; these limits are not DDoS protection.
