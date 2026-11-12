# Changelog

## v0.3.0 — Unreleased

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

# v0.2.0-beta.1

- Opt-in AES-256-GCM encrypted snapshots with exclusive writer lock, atomic replacement and fsync; restore/failure tests.
- Persist replay intent before transmission; interrupted sends recover as unknown and never automatically retry.
- Optional separate-key HMAC ingress with five-minute timestamp window and ten-minute durable dedup, bounded JSON and event capacity.
- DNS deadline, own-property/missing-value comparisons, explicit uncertain-delivery UI, health endpoint and secret-file support.
- Private Docker pilot and ingress-only proxy recipe; backup/recovery/rotation documentation.
- No Hostinger deployment, public TLS/ingress verification or real staging replay performed. Beta only, not production-ready.

# Changelog

## 0.1.0-alpha.1

Experimental first local release.

- Add private memory-only JSON capture, redaction, fixture export and comparison.
- Add explicitly confirmed staging replay with an exact URL allowlist and pinned public-IPv4 HTTPS transport.
- Block private/metadata destinations and redirects; do not retry automatically.
- Add responsive UI, security/resource limits, tests and Docker packaging.
- Document product assumptions, known limitations and development milestones.

Known limitations: memory-only storage; no public provider ingress; no original provider signatures or authorization forwarded; pattern-based redaction is not DLP; real staging network replay has not been exercised; local container runtime smoke was blocked by Docker startup. Follow the exact release's CI results for container validation status. Not production-ready.
