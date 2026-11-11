# Beta verification — 2026-11-11

Scope: v0.2.0-beta.2 private single-user synthetic-data pilot. Not production-ready.

## Hostinger compatibility release

The beta.2 changes add `compose.hostinger.yaml`, a named-volume private VPS recipe, documentation and an isolated Docker regression test. No application runtime source changed. All 36 Node tests, syntax checks and the existing local-only Playwright suite were rerun successfully. Desktop/mobile screenshots were regenerated with synthetic data and visually inspected. The new profile smoke passed actual capture and sanitized persistence through stop/start, non-root execution, disabled ingress, loopback-only configured binding and hardening checks. Test containers have no external network or published ports and are cleaned up with their disposable volume. This does not verify live Hostinger deployment or actual-host backup restore.

Review follow-up requires Docker Engine 28+ for loopback publishing and Compose 2.24.4+ for the isolation override; the smoke checks disabled ingress returns exactly 404 and removes its generated image as well as container/volume. Cleanup failures preserve the original test error and still remove temporary files.

## Passed locally

- 36/36 Node unit/API/storage tests on macOS Node 25.2.1, including AES-GCM roundtrip/tamper/wrong-key, exclusive lock, restrictive permissions/symlink/hard-link boundaries, failed commit, 32MiB bounds, signed ingress auth/freshness/dedup, retention/delete, recovered attempts, durable-before-send failures, active-replay deletion race and isolated admin rate budget.
- Syntax checks for all source modules.
- Playwright Chromium: unlock, double-click capture, sanitization, diff/export/delete, token reset, mobile layout, replay cancellation/expiry/double click, unknown delivery after connection interruption and reload. All non-local requests blocked, with injected replay transport only. Mobile screenshot visually inspected.
- Default and pilot Compose configuration checks. Digest-pinned official Node 24 Alpine image build.
- Actual isolated Docker runtime: `--network none`, non-root/read-only/dropped capabilities, encrypted volume, signed synthetic capture, graceful stop/restart, retained sanitized event. Disposable test container and volume removed. Earlier alpha local Docker startup issue did not recur.

## Release gates

GitHub CI passed Node 22/24 plus isolated hardened container and persistent signed-capture restart on implementation commit d013818: https://github.com/chanpollo/webhook-replay-lab/actions/runs/42977300375 . Verify all jobs for the exact release commit before publication.

## Not performed / not established

- No live external staging replay, public-host ingress, TLS/proxy routing, actual-host recovery, performance/load/DoS testing, penetration test or formal security audit.
- No native provider signatures, multi-user isolation, encryption key migration or exactly-once delivery guarantee.
- No Hostinger deployment. Verified account has Single shared hosting and no suitable VPS; a hosting choice and any needed purchase authorization remain pending.
- Local snapshot and restart tests do not establish real disk/power-loss durability or backup-restore correctness on an eventual host.

No service remains running after these tests. Keep ingress disabled and use synthetic data until the documented host acceptance gates pass.
