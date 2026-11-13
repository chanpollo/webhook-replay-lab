# Release 1 engineering checkpoint — 2026-11-13

Baseline: clean `main` at `9f3d86b`. No prior work was reverted. The candidate remains v0.3.0, unreleased; runtime build `1727e52ec60a`.

## Completed engineering

- [Offline key rotation](STORAGE_KEY_ROTATION.md): locked source, distinct destination, validated authenticated readback, original ciphertext preserved.
- [Stricter-redaction migration](REDACTION_MIGRATION.md): verified encrypted copy with sanitized payloads, generic labels and no replay history; original and bounded deduplication metadata preserved.
- [Local operational alerts](ALERTS.md): fixed health/recovery/capacity/signature-failure/unknown-delivery signals over the private loopback admin endpoint; no external notification destination.
- Session-only onboarding for preview, capture, fixture download/import and comparison, with staging/unknown-delivery guidance and responsive browser coverage.
- Crash/fsync and failed replay-commit tests. They found and fixed a transient pre-send storage failure that could previously be caught and followed by HTTP 200; it now fails closed with 503.
- Dedicated 30-minute CI workload and locked test-only browser acceptance. See the [predeclared reference and limits](CAPACITY_REFERENCE.md).

## Local evidence

- Node 22.14.0: **143/143 passed**, no skips ([raw output](evidence/r1-key-rotation/node22.txt)).
- Node 24.15.0: **143/143 passed**, no skips ([raw output](evidence/r1-key-rotation/node24.txt)).
- `npm run check` and `git diff --check`: passed locally.
- Five isolated Chrome browser suites passed: UI/replay, fixtures, redaction, onboarding and dashboard ([raw summaries](evidence/r1-key-rotation/browser.txt)). Screenshots contain synthetic captures and injected replay outcomes only. Mobile layouts were checked at 320/390/1440 px; visual review here is agent review, not independent human acceptance.
- [10-second seeded workload smoke](evidence/r1-key-rotation/endurance-smoke.json) passed, including exact retained IDs, masking, 429 rejection and stopped-writer reopen. It validates the harness and **does not** count as the 30-minute endurance gate.
- Fault tests kill a child during partial temporary write, after file fsync and after rename; inject directory-fsync failure; and fail commits before validation/send and after transport. Recovery authenticates a complete generation, preserves stale-lock handling and does not retry replay.

Tests use synthetic data and loopback TLS, including IPv6. Network/browser execution required leaving the sandbox because sandboxed socket binds returned EPERM. No public listener, real Stripe delivery or external staging replay was created.

## CI and platform status

Before source publication, remote `main` was checked at `9f3d86b`; its CI run `43381112126` succeeded and no existing CI runs were in progress. GitHub access works outside the network sandbox; no credentials were changed. Candidate CI will run on an isolated branch so main remains unchanged.

The Mac Docker daemon is unavailable. The new runtime therefore still requires exact-commit image/security, Compose/proxy, kind and 30-minute CI evidence before those can be claimed. Previous source `083ceed` image/cluster evidence applies to that prior runtime only. No image registry publication, formal GitHub release, Hostinger provisioning or service purchase has occurred.

## Remaining Release 1 gates

The roadmap scope is unchanged. Exact candidate CI, observed operator migration/cutover on each deployment route, a notification supervisor/responder, independent threat review and human task/interview evidence remain required. Process/fsync tests do not prove power-loss or actual customer volume durability.

External tests require an authorized Stripe test-mode sandbox and owned HTTPS receiver. Hostinger acceptance requires a named authorized environment and real install/lifecycle/network/storage evidence. Permanent image publication needs an approved registry destination/publication authorization, and formal release needs exact final-commit CI and its separate authorization boundary resolved. These gates remain open rather than waived to label this Release 1.

See [full roadmap](ROADMAP.md) and [prior self-host acceptance](SELF_HOST_ACCEPTANCE.md).
