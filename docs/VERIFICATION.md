# Beta verification — 2026-11-11

Scope: v0.2.0-beta.1 private single-user synthetic-data pilot. Not production-ready.

## Passed locally

- 36/36 Node unit/API/storage tests on macOS Node 25.2.1, including AES-GCM roundtrip/tamper/wrong-key, exclusive lock, restrictive permissions/symlink/hard-link boundaries, failed commit, 32MiB bounds, signed ingress auth/freshness/dedup, retention/delete, recovered attempts, durable-before-send failures, active-replay deletion race and isolated admin rate budget.
- Syntax checks for all source modules.
- Playwright Chromium: unlock, double-click capture, sanitization, diff/export/delete, token reset, mobile layout, replay cancellation/expiry/double click, unknown delivery after connection interruption and reload. All non-local requests blocked, with injected replay transport only. Mobile screenshot visually inspected.
- Default and pilot Compose configuration checks. Digest-pinned official Node 24 Alpine image build.
- Actual isolated Docker runtime: `--network none`, non-root/read-only/dropped capabilities, encrypted volume, signed synthetic capture, graceful stop/restart, retained sanitized event. Disposable test container and volume removed. Earlier alpha local Docker startup issue did not recur.

## Release gates

GitHub CI runs Node 22/24 plus isolated hardened container and persistent signed-capture restart. Verify all jobs for the exact release commit before publication.

## Not performed / not established

- No live external staging replay, public-host ingress, TLS/proxy routing, actual-host recovery, performance/load/DoS testing, penetration test or formal security audit.
- No native provider signatures, multi-user isolation, encryption key migration or exactly-once delivery guarantee.
- No Hostinger deployment. Verified account has Single shared hosting and no suitable VPS; a hosting choice and any needed purchase authorization remain pending.
- Local snapshot and restart tests do not establish real disk/power-loss durability or backup-restore correctness on an eventual host.

No service remains running after these tests. Keep ingress disabled and use synthetic data until the documented host acceptance gates pass.
