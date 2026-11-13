# Self-hosted Hook: Docker, Kubernetes and Hostinger

This is a single-process developer workbench with one shared inbox, not a production delivery gateway. The candidate supports capture/read credentials, but not separate tenants or per-user event isolation. The baseline signed receiver uses a custom HMAC protocol. Provider adapters and deployment changes must be checked against the selected revision and its acceptance evidence; baseline results do not validate newly added integrations. Real HTTPS replay has been verified against controlled local receivers, and encrypted backup restoration has passed in an isolated Docker sandbox. No live Hostinger deployment has been verified. The current candidate has passed controlled external HTTPS replay and owned-host sandbox acceptance; see FINAL_CANDIDATE_ACCEPTANCE.md for exact scope, candidate and cleanup evidence. A PHP/shared-hosting plan cannot run this Docker service. Obtain an authorized VPS or compatible Docker host before deployment. Do not replace an existing website.

## Target deployment architecture

Use one reviewed OCI application image across Docker/Compose, Kubernetes and a compatible Hostinger VPS. Build once for each supported architecture, test and scan the final artifact, then promote the same immutable digest. See [container image strategy](CONTAINER_IMAGE.md) and [install/evidence matrix](INSTALL.md). Registry publication is a separate release step; these instructions do not assert a published image exists.

- **One writer:** one application process owns one local encrypted snapshot and its lock. Do not add replicas, an autoscaler or a shared/network filesystem to obtain availability. Stop the old writer before the replacement starts.
- **Private administration:** Docker publishes admin only to host loopback. Kubernetes should use a ClusterIP with no public admin Ingress/LoadBalancer and restrict in-cluster clients; use an authenticated operator access path. ClusterIP alone is not access control.
- **Optional receiver:** only the reviewed exact signed POST routes may pass through a separately configured TLS edge. No catch-all proxy to the application, admin, metrics or health endpoints. Test route/method denials and abuse limits on the actual ingress controller. Enabling a provider adapter does not authorize public exposure.
- **Persistence and secrets:** a dedicated data volume plus independently provisioned admin/storage/receiver secrets. Keep storage keys separately recoverable. Docker environment secrets are inspectable by Docker administrators; Kubernetes Secrets are not automatically encrypted at rest. File mounts must satisfy the application's ownership/mode checks, not just a chart schema.
- **Updates and recovery:** graceful stop, offline snapshot backup, then replacement with a pinned digest. Retain the previous digest and matching data/key backup. Never remove a live lock or mount one store in old and new pods simultaneously.

**Kubernetes is an implementation target, not a verified installation.** The deployment worker is preparing the manifests. Require single replica, no surge (for example Recreate), persistent-volume semantics compatible with one writer, non-root UID 1000, read-only root, dropped capabilities, no privilege escalation, resource limits and graceful termination. Readiness must reflect actual availability. Do not configure aggressive liveness restarts that repeatedly restart a locked/corrupt store. Validate the actual CSI driver, Secret ownership, DNS/egress policy and backup restore in a disposable cluster before declaring support. ReadWriteOnce alone can permit multiple pods on one node; it is not the writer lock.

**Hostinger is a deployment destination, not a different runtime:** use an authorized compatible VPS with Docker/Compose; a managed template/catalog route requires its own verified program flow. PHP/shared/static hosting cannot run this service. Existing owned-host tests do not prove Hostinger acceptance, and no VPS purchase is required merely to publish source or plan a distributable image.

## Private install

Use a supported Linux host with Docker Compose. Keep port 4319 on loopback. Do not expose the admin UI through a public reverse proxy. Use SSH forwarding from your own computer: `ssh -L 4319:127.0.0.1:4319 user@your-owned-host`, then open http://127.0.0.1:4319.

1. Check out the release tag and run `npm test` if Node 22+ is installed.
2. Create a private `data` directory owned by container UID 1000: `sudo install -d -m 700 -o 1000 -g 1000 data`. Run this only in the project directory; inspect an existing directory before changing ownership.
3. Create `.env` with mode 600. Set independently random `LAB_TOKEN` (at least 32 characters) and `LAB_STORAGE_KEY` (exactly 64 hex characters, e.g. generated with `openssl rand -hex 32`). Store the encryption key securely **separately** from data backups. Never commit `.env`, keys or inbox data. An encryption key alone does not secure a compromised host. Docker administrators can inspect environment values. Native Node also supports `LAB_TOKEN_FILE`, `LAB_STORAGE_KEY_FILE`, and `LAB_INGRESS_KEY_FILE`.
4. Keep `STAGING_ALLOWLIST` empty until you explicitly verify ownership and harmless downstream staging effects.
5. `docker compose -f compose.pilot.yaml config --quiet` then `docker compose -f compose.pilot.yaml up -d --build`. Never share expanded Compose config; it can contain secrets.
6. Check health and private access through SSH forwarding, capture **synthetic data**, restart, and verify the captured record remains. Check host monitoring, disk capacity and logs. Configured credentials are not printed by the app.

No restart policy intentionally: a crash can leave a lock that needs operator investigation. Check container exit and health status using external host monitoring. One process only. Horizontal replicas and network filesystems are unsupported. The image runs non-root with a read-only root filesystem, resource bounds and dropped capabilities; only `/data` is writable.

## Native Node persistence (without Docker)

Use the reviewed candidate checkout for the optional doctor, redaction and scoped-credential features; the stable tag may not contain them. `npm start` does not load `.env` automatically.

Create a dedicated directory owned by your current OS user, not writable by group/others (mode 700 recommended). Do not point at an existing live workspace or change its key. Provision independent random admin token and 32-byte hexadecimal storage key in private files (mode 600). Unlike the Docker bind-mount recipe above, a native directory must **not** be changed to UID 1000 unless that is your own user ID.

Set these variables in the same shell before both diagnostics and startup:

```sh
export LAB_TOKEN_FILE=/your/private/workspace/admin-token
export LAB_STORAGE_KEY_FILE=/your/private/workspace/storage-key
export LAB_DATA_PATH=/your/private/workspace/inbox.enc
export STAGING_ALLOWLIST=''
# If 4319 is already occupied, choose another unused local port; do not stop other work.
export PORT=4319
npm run doctor
npm start
```

Replace the example paths with your provisioned files. No token belongs in command arguments or a URL. Open `http://127.0.0.1:4319` (or your selected port) and use the token matching the file. Configured tokens are not printed at startup. Keep the key and encrypted snapshot paired across restarts; back up the key separately. Stop gracefully before copying a snapshot. Restart with the **same variables and files**, then verify a synthetic retained event before relying on persistence. Doctor checks configuration shape, not a complete storage/recovery or network-security audit.

## Recovery, retention and upgrades

Only sanitized payloads, bounded attempt records and ingress dedup IDs are stored. AES-256-GCM snapshots use atomic replacement and fsync before success, but this is not a transactional delivery queue or a hardware durability guarantee. An in-flight send recovered after restart is `unknown_delivery`; never automatically retry it. Pending approvals are deliberately lost on restart.

- Gracefully stop the container before backup. Copy `data/inbox.enc` to private backup storage, preserving mode 600 and ownership; back up the key separately. Test restoration in an isolated host with egress disabled and the same version/key. Do not copy the `.lock` file.
- A wrong key, corrupt file or write failure fails closed. A write response may be uncertain: inspect the restored inbox before another capture/replay. Never silently initialize an empty store over damaged data.
- After a crash, prove there is **no running writer**, preserve the encrypted snapshot, then remove only `data/inbox.enc.lock`. Start and inspect recovered attempts. Never remove a live writer's lock.
- Events expire after 24 hours and are inaccessible on the next API access; a sweep updates the snapshot within 30 seconds while running. On startup, expiry is enforced before API data is returned. Deleted/expired data may remain in old backups, filesystem snapshots, exports or storage blocks. No secure erasure claim.
- Before upgrading, stop and back up. Keep the previous image/tag plus key and data backup. Restore that matched set to roll back; the alpha cannot read the beta encrypted store. The store schema is versioned and rejects unsupported versions.
- Rotate the admin token or ingress key by stopping, replacing the corresponding secret and restarting. There is no overlapping-key window. Use the [offline encryption-key rotation](STORAGE_KEY_ROTATION.md) to create and verify a separate encrypted copy; never replace the key in place. For stricter redaction, use the [offline migration](REDACTION_MIGRATION.md), noting its explicit removal of labels/history from the copy.

## Optional signed ingress

Leave disabled unless the sender is yours and you have completed a threat-model and deployment review. It requires persistent storage and a separate `LAB_INGRESS_KEY` (32 random bytes encoded as 64 hex characters). It grants only append access, never admin/read/replay access.

Your controlled sender POSTs raw JSON to `/ingress` with:

- `Content-Type: application/json`
- `X-Lab-Timestamp`: Unix seconds, strictly less than five minutes from the receiver clock
- `X-Lab-Event-Id`: 1–128 ASCII letters, digits, underscores or hyphens; unique per event
- `X-Lab-Signature`: `sha256=` plus lowercase hex HMAC-SHA256 using the **decoded hex key**, over `timestamp + "." + eventId + "." + exact raw JSON bytes`

A valid signed duplicate ID with identical raw body bytes is acknowledged without another event for eleven minutes, including across normal restarts. Reusing an ID with different bytes returns 409. Legacy receipts without payload-hash evidence also return 409; do not retry with a new ID blindly. This is not general exactly-once delivery. Receipt timestamps remain stored as version-1 two-field tuples; an optional receiptHashes field holds SHA-256 body digests. An older version can read the snapshot but may discard hash evidence on save; re-upgrading then treats those IDs conservatively as legacy conflicts. The sender must preserve IDs across retry; longer-term duplicates are possible. Full inbox returns 409. On an uncertain HTTP result the sender can retry the same signed ID within that window, but this is capture only and never triggers an outbound replay.

Only expose the exact POST route over TLS, using `deploy/Caddyfile.example` as an **untested deployment recipe**. Keep admin routes inaccessible publicly. Add network-level abuse controls, monitoring and a request-size/time limit, configure DNS and TLS for a hostname you own, and confirm every other route returns 404. Ingress preflights signature headers before reading bodies and allows at most eight in-flight ingress requests, releasing slots on response completion or disconnect. This does not isolate pre-header sockets or the shared listener; edge connection/header-time limits remain required. The public ingress budget can be exhausted by attackers (authenticated admin has a separate budget); this is not DDoS protection. The proxy must preserve raw body bytes and must not strip Origin to bypass browser-origin protections. Do not log credentials or payloads.

## Actual-host acceptance checks (not yet passed)

- Authorized VPS/runtime, owned domain, TLS and restricted firewall/proxy checked.
- Public admin paths inaccessible; authenticated signed synthetic ingress succeeds and bad/expired signatures fail.
- Restart and isolated backup restore validated on the actual host.
- A real replay to an owned, explicitly authorized harmless HTTPS staging endpoint succeeds; redirect/private-DNS denial verified.
- Capacity/abuse tests, operational monitoring, independent security review and recovery ownership accepted.

Private local debugging and the isolated self-host profile are tested release workflows. Use synthetic data for installation checks; review redaction before using your own integration data. Host-specific checks remain required before relying on a remote installation. Do not route production webhook traffic through it.

## Image update policy

The base Node 24 Alpine image is pinned by digest for reproducibility. Before each release, check upstream security advisories, select a supported digest, rebuild and rerun all Node/container tests. Pinning does not imply a vulnerability scan has passed. Runtime/OS patching and backup monitoring remain operator duties.
