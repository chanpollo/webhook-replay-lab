# Release 1 engineering checkpoint — 2026-11-13

Baseline: clean `main` at `9f3d86b`. No prior work was reverted. The candidate remains v0.3.0, unreleased; runtime build `e764835f4f8d`.

## Completed engineering

- [Offline key rotation](STORAGE_KEY_ROTATION.md): locked source, distinct destination, validated authenticated readback, original ciphertext preserved.
- [Stricter-redaction migration](REDACTION_MIGRATION.md): verified encrypted copy with sanitized payloads, generic labels and no replay history; original and bounded deduplication metadata preserved.
- Private CLI requests now bypass environment proxies with an explicit direct agent; fixture CLI secret files use the same private/exclusive reader as the server. A Node 24 control test demonstrates interception by a local fake proxy, then verifies both hardened CLIs make zero proxy requests.
- [Local operational alerts](ALERTS.md): fixed health/recovery/capacity/signature-failure/unknown-delivery signals over the private loopback admin endpoint; no external notification destination.
- Session-only onboarding for preview, capture, fixture download/import and comparison, with staging/unknown-delivery guidance and responsive browser coverage.
- Crash/fsync and failed replay-commit tests. They found and fixed a transient pre-send storage failure that could previously be caught and followed by HTTP 200; it now fails closed with 503.
- Explicit Stripe retry coverage changes signature/timestamp while retaining event ID/raw bytes, including stale-signature denial, changed-body conflict and real encrypted restart. Existing same-header dedup tests remain.
- Exact-image lifecycle CI now also pins the v0.2.1 source commit for upgrade/rollback/re-upgrade and separate-volume restore; both sources use the current patched base runtime.
- Dedicated 30-minute CI workload and locked test-only browser acceptance. See the [predeclared reference and limits](CAPACITY_REFERENCE.md).

## Local evidence

- Node 22.14.0: **147/147 passed**, no skips ([raw output](evidence/r1-key-rotation/node22.txt)).
- Node 24.15.0: **147/147 passed**, no skips ([raw output](evidence/r1-key-rotation/node24.txt)).
- `npm run check` and `git diff --check`: passed locally. Test-only Playwright lockfile npm advisory check reports zero known findings; this is separate from the shipped image scan.
- [Scoped source review](R1_SOURCE_REVIEW.md) rejects equivalent old/new hex keys and incomplete diagnostics that could otherwise appear healthy; it is separate from independent human threat review.
- Five isolated Chrome browser suites passed: UI/replay, fixtures, redaction, onboarding and dashboard ([raw summaries](evidence/r1-key-rotation/browser.txt)). Screenshots contain synthetic captures and injected replay outcomes only. Mobile layouts were checked at 320/390/1440 px; visual review here is agent review, not independent human acceptance.
- An additional 10-second Mac smoke attempt failed its predeclared 250 ms p95 budget; the cause is not established ([failure output](evidence/r1-key-rotation/endurance-smoke-budget-failure.txt)). This is not dedicated-host evidence and the budget was not relaxed. The harness now retains measured JSON before reporting a latency-budget failure; the subsequent dedicated 30-minute CI gate passed without relaxing that budget; see final acceptance.
- [10-second seeded workload smoke](evidence/r1-key-rotation/endurance-smoke.json) passed, including exact retained IDs, masking, 429 rejection and stopped-writer reopen. It validates the harness and **does not** count as the 30-minute endurance gate.
- Fault tests kill a child during partial temporary write, after file fsync and after rename; inject directory-fsync failure; and fail commits before validation/send and after transport. Recovery authenticates a complete generation, preserves stale-lock handling and does not retry replay.

Tests use synthetic data and loopback TLS, including IPv6. Network/browser execution required leaving the sandbox because sandboxed socket binds returned EPERM. No public listener, real Stripe delivery or external staging replay was created.

## CI and platform status

Before source publication, remote `main` was checked at `9f3d86b`; its CI run `43381112126` succeeded and no existing CI runs were in progress. Main was checked unchanged again after final acceptance. GitHub access worked outside the network sandbox; no credentials were changed.

**Exact tested source `fae063f`, build `e764835f4f8d`, passed all jobs in [CI run 43389359288](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43389359288).** This includes Node 22/24 (147 tests each), five browser suites, immutable image/security, Compose/proxy, offline copies/alerts, pinned-source upgrade/rollback/restore, disposable kind and the full 30-minute native reference workload. See [final engineering acceptance and raw evidence](R1_ENGINEERING_ACCEPTANCE.md) for measured latency, resource bounds, image/checksum identity and scope.

The Mac Docker daemon was unavailable; the authorized dedicated CI route supplied Docker/Kubernetes execution evidence instead. No image registry publication, formal GitHub release, Hostinger provisioning or service purchase occurred.

## Remaining Release 1 gates

The roadmap scope is unchanged. Observed operator migration/cutover on each deployment route, a notification supervisor/responder, independent threat review and human task/interview evidence remain required. Process/fsync tests do not prove power-loss or actual customer volume durability.

Real Stripe delivery can first use an authorized sandbox CLI session and its own listener secret without public HTTPS; [local test status/procedure](STRIPE_LOCAL_TEST.md). No CLI/config/session was available here. Public receiver TLS/isolation and external staging replay separately require an authorized owned HTTPS environment. Hostinger acceptance requires a named authorized environment and real install/lifecycle/network/storage evidence. Permanent image publication needs an approved registry destination/publication authorization, and formal release needs exact final-commit CI and its separate authorization boundary resolved. These gates remain open rather than waived to label this Release 1.

See [full roadmap](ROADMAP.md) and [prior self-host acceptance](SELF_HOST_ACCEPTANCE.md).
