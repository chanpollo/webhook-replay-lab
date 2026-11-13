# Changelog

## v0.3.0 — Unreleased

No v0.3.0/v1 release, live Hostinger deployment or program acceptance is implied by these main-branch changes. Historical sections describe their own release's evidence, not the current candidate.

### Additional Release 1 engineering (not yet image/cluster verified)

- Add offline stricter-redaction migration to a verified encrypted copy; reset labels and remove replay history from the copy while preserving source and deduplication metadata.
- Prevent alert/fixture CLI bearer credentials from following opted-in environment proxies; use an explicit direct-loopback HTTP agent with bounded responses/deadlines. Harden fixture CLI secret-file loading and exclusive sources.
- Add private loopback operational alert CLI and bounded signature-failure counters, with fixed actions and no external notifications.
- Add session-only task onboarding for preview, capture, export, import and comparison; cover expiry, reset and responsive behavior.
- Add process-crash/fsync and replay-commit fault tests. Fix replay returning a success after a transient failed pre-send storage commit; fail closed with 503 before further handling.
- Add a dedicated 30-minute CI workload with predeclared bounds, phase latency/status counts, CPU/RSS/disk samples and stopped-writer verification.

- Add offline encryption-key rotation to a distinct destination, preserving and locking the original; validate and read back the encrypted copy before reporting success.
- Reject existing destinations, wrong keys and writer locks; keep diagnostics free of secrets and paths. Document cutover, rollback and backup retention.
- Reuse snapshot validation and include the shipped rotation CLI in runtime build identity. This does not complete Release 1 acceptance or establish Hostinger support.

### Self-host candidate engineering acceptance (not a formal release)

- Add shared bounded private secret-file loading, a loaded-image Compose profile, hardened single-writer Kubernetes manifests and isolated cluster acceptance CI.
- Export the exact scanned Linux amd64 image as a checksummed build artifact, not a registry publication or formal release.

- Add administrator-only, low-cardinality operational diagnostics without payloads, identifiers or target URLs.
- Harden ingress header/body concurrency, timestamp boundaries and persisted payload-conflict detection while preserving legacy snapshot readability.
- Add an opt-in Stripe test-mode signature adapter; never accept live-mode events or forward original provider authorization/signatures.
- Add an isolated Caddy route-isolation CI gate, a Release 1 roadmap and a multi-platform installation guide with explicit tested/untested coverage.
- Source `083ceed` / runtime `58f35f208f9b` passed 129 tests and exact Docker/proxy/security/disposable-kind CI. See [self-host acceptance](docs/SELF_HOST_ACCEPTANCE.md). Actual customer host/provider acceptance remains open; the earlier external-receiver evidence below does not certify the new runtime.

### Latest candidate additions and verification

- Add restricted JSONPath redaction rules on top of default masking, a non-storing Workbench preview, consistent capture/ingress/import sanitization and fail-closed startup for incompatible retained payloads.
- Add bounded capture-only/read-only credentials for one shared inbox, exact route permissions, per-credential request budgets and restart-based rotation. No tenant isolation or general-purpose RBAC claim.
- Add read-only `doctor` diagnostics with bounded configuration checks and no secret output; add bounded synthetic capacity/abuse regressions.
- Support conservative ordinary-global IPv6 DNS validation and exact address/family pinning. Reject unsafe mixed DNS answers, mapped/transition/special ranges, scoped addresses and IP literal URLs. No retry or fallback after sending.
- Verify the candidate through 92 tests, Node 22/24 and container/security CI, owned-host isolated persistence/upgrade/rollback/recovery, and controlled external HTTPS receiver correlation. Verify scoped denials, default/custom redaction and no forwarded Authorization header. Stop and verify closure of all temporary test endpoints.
- Increase only the host smoke harness health wait from 30 to 90 seconds after an initial timeout; keep health and recovery assertions intact. Record the initial failure without claiming an unproven root cause.
- Record an agent-operated fresh-install walkthrough and clarify native Node persistence, `.env` behavior, ownership, port selection, and API versus CLI acceptance evidence. This is not human-user research.
- See [final candidate acceptance](docs/FINAL_CANDIDATE_ACCEPTANCE.md) and [remaining product gates](docs/RELEASE_ONE_GAPS.md); no production throughput, business success, Hostinger acceptance or market-parity claim follows from these tests.

### Earlier candidate changes

- Invalidate fixture previews on view/history navigation, and retain a regression test.
- Add pinned immutable-image vulnerability and Node advisory CI gates with raw evidence.
- Remove unused npm/yarn runtime tooling; verify sandbox install, upgrade, rollback and recovery.

- Refresh the official Node 24 image digest and pin the Alpine stable zlib vendor fix; verify its presence in container QA.

- Add bounded portable fixture collections, filtered export, all-or-nothing validation and local import.
- Add offline CI verification and explicit single-fixture staging replay CLI with machine-readable outcomes and no retries.
- Replace quadratic free-text email searching with linear candidate scanning.

- Validate version-1 fixture integrity and preview re-redacted JSON before importing a fresh local event; import cannot send a webhook.

- Refresh the light UI and activity charts; reduce repetitive helper text while preserving replay warnings.
- Show package version and a reproducible runtime-source build identifier.
- Allow browser QA to use an installed Chrome or Edge channel when bundled Chromium is unavailable.
- Add data-backed Overview, searchable Replay history and focused Workbench views.
- Chart retained captures/replay starts and explicit replay outcomes; report unknown delivery separately from HTTP responses, with latency only when recorded.
- Expose persisted per-event attempt timelines and one-click event investigation without changing replay confirmation, retention or security policy.
- Show server-snapshot freshness, manual refresh failure, memory-only versus encrypted storage, bounded-history caveats and synthetic-record inclusion.
- Add keyboard tabs and Back/Forward, accessible chart tables, readable responsive layouts and regenerated synthetic screenshots.
- Add six analytics unit tests, an encrypted-history browser suite and reproducible 200-event/4,000-attempt local performance checks.


## 0.2.1 — 2026-11-11

- Fix isolated Docker smoke cleanup to remove its separate restore-test volume as well as the active profile volume. Only exact disposable project labels/names are removed; application behavior is unchanged.

## 0.2.0 — 2026-11-11

Stable release for private, single-user developer debugging. No Hostinger deployment or public delivery-gateway claim.

- Persist and send the same replay attempt ID for receiver-side investigation of uncertain delivery.
- Recheck approval expiry at consumption, including requests whose bodies arrive across the deadline.
- Prevent stale inbox responses after token changes and stale replay reviews after selection/cancellation changes.
- Validate restored state before recovery, release own locks on failed startup, and bound sanitized payload expansion.
- Exercise real loopback HTTPS: delivery, TLS trust/hostname enforcement, redirects, size cap, disconnect and timeout, with no automatic retry.
- Verify encrypted backup restoration into a separate local directory and isolated Docker named volume.
- Redesign the responsive workbench with distinct capture/inbox/inspect/replay panels, visible focus states, clear labels and keyboard skip navigation.
- Pin CI actions by commit and refresh private deployment/security boundaries.


## 0.2.0-beta.2

- Add a dedicated Hostinger VPS Compose profile with private loopback access, encrypted named-volume storage and signed ingress disabled.
- Add an isolated Docker regression test for the profile and deployment/partner-readiness documentation.
- Keep the JavaScript/Node.js stack and existing UI/screenshots. No live Hostinger deployment or program acceptance is claimed.

## 0.2.0-beta.1

- Opt-in AES-256-GCM encrypted snapshots with exclusive writer lock, atomic replacement and fsync; restore/failure tests.
- Persist replay intent before transmission; interrupted sends recover as unknown and never automatically retry.
- Optional separate-key HMAC ingress with five-minute timestamp window and ten-minute durable dedup, bounded JSON and event capacity.
- DNS deadline, own-property/missing-value comparisons, explicit uncertain-delivery UI, health endpoint and secret-file support.
- Private Docker pilot and ingress-only proxy recipe; backup/recovery/rotation documentation.
- No Hostinger deployment, public TLS/ingress verification or real staging replay performed. Beta only, not production-ready.

## 0.1.0-alpha.1

Experimental first local release.

- Add private memory-only JSON capture, redaction, fixture export and comparison.
- Add explicitly confirmed staging replay with an exact URL allowlist and pinned public-IPv4 HTTPS transport.
- Block private/metadata destinations and redirects; do not retry automatically.
- Add responsive UI, security/resource limits, tests and Docker packaging.
- Document product assumptions, known limitations and development milestones.

Known limitations: memory-only storage; no public provider ingress; no original provider signatures or authorization forwarded; pattern-based redaction is not DLP; real staging network replay has not been exercised; local container runtime smoke was blocked by Docker startup. Follow the exact release's CI results for container validation status. Not production-ready.
