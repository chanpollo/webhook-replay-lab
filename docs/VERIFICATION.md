# Candidate follow-up — 2026-11-12 15:08 UTC

- Final immutable-image Trivy scan passed with zero reported findings: `sha256:096daf59471925f404b5297afe0c72ceda1c9ccecbc046611bbec396066ffc16`; raw evidence IMAGE_SCAN_FINAL_RAW.json. Final-image lifecycle rerun also passed.
- UI now invalidates pending fixture previews when changing tabs or using Back/Forward. Fresh-browser regression passed. New source build: `cf692e61d917`.
- Local no-network CI-equivalent matrix: **59/59 on Node 22 and 59/59 on Node 24**. The initial Alpine test harness lacked OpenSSL (57/59); installing that declared prerequisite in disposable test images resolved both TLS-test failures. No application tests were skipped or weakened.
- Fresh isolated browser workbench, dashboard/history and fixture suites passed. This is automated fresh-session simulation, not human fresh-user acceptance.
- CI now scans an immutable final image ID with pinned Trivy and retains raw findings; Node core range checks and raw feed are reproducible using `scripts/check-node-advisories.cjs`. See SECURITY_REPRODUCTION.md. This workflow has not yet run on a published final commit.
- External staging/actual-host check: no configured real Hook endpoint was found. Dot cloud inspection found no supported exposed HTTPS tunnel capability and only loopback listeners. Corporate SSH aliases belong to other services and were deliberately not repurposed. External E2E remains **not run**, requiring a controlled, authorized HTTPS staging receiver; actual-host acceptance remains unverified. No public endpoint/service was created.

# Security and lifecycle checkpoint — 2026-11-12 15:02 UTC

- Runtime source build remains `6e6a585c28b6`; image changed to `sha256:d51f5e226e2233159cb1297c3362ac9f2fad09f21d509c7fe3298752789c45ac`.
- Official Aqua Trivy initially found 19 npm-toolchain advisory instances (6 high, 12 medium, 1 low). This app has no npm runtime dependencies. Removed unused npm/npx/yarn from the runtime image instead of suppressing findings. Rebuilt and rescanned with Trivy 0.76.2: **0 reported vulnerabilities** across detected Alpine and Node package targets. Evidence: IMAGE_SCAN.json. This is not proof of no vulnerabilities or exploitability; Node's embedded libraries are not comprehensively enumerated by this scan.
- Official Node.js security-wg core feed: 204 entries checked against Node 24.22.3 with installed local semver. All 47 matching major-version ranges are covered by patched ranges; no unparsed or unresolved entries. Evidence: NODE_ADVISORY_CHECK.json. Feed completeness/unknown CVEs remain outside scope.
- After image change: 59/59 tests, syntax checks, isolated Hostinger-profile test and lifecycle test passed.
- New `test/lifecycle-smoke.mjs`: fresh install, stopped encrypted backup, upgrade from v0.2.1 application source, rollback reading candidate-created data, re-upgrade, and backup recovery into a separate empty volume passed. Both source versions use the current patched runtime. No network or host ports; resources cleaned. This does not verify a historical release image or an actual Hostinger host.
- Fresh-user documentation review found and corrected stable/candidate confusion, missing checkout/cd, mismatched import label/limits, and incomplete matching-token CLI startup. This is a reviewer walkthrough, **not actual new-user usability evidence**.
- Still not a v1 release claim: authorized external staging E2E, actual-host acceptance, independent final review, actual fresh-user acceptance and exact published-commit CI remain outstanding. No push/tag/release/deploy occurred.

# Collections and CI readiness — 2026-11-12 14:55 UTC

Current source build: `6e6a585c28b6` (package remains 0.3.0, unreleased). Candidate image: `sha256:29eef2b7045b127ddfc24d5b81d4bf450a8973adf30120c9ea9f742721ff1f63`.

- Added 1–20-entry portable collections, filtered export, deterministic metadata, preview and all-entry validation before local import. Exported compact JSON round-trips through the CLI, including near-limit cases. Capacity/invalid-entry checks reject without partial import.
- Added offline CI verify (fails on invalid input or additional redaction required) and explicit single-entry replay CLI. Replay requires loopback server, protected token, explicit target/confirmation and server allowlist; it never auto-retries or batch replays. Tests use injected transport, not an external staging service.
- 59/59 Node tests, syntax, diff validation, all three browser suites and isolated Docker profile passed on final source. Browser coverage includes actual downloaded collection -> CLI verify.
- Independent read-only review found additional pathological regex cases and pretty-JSON file-size mismatch. Fixed bounded token scanning, trailing-dot index trimming, fixed-width key splitting and compact export. Added adversarial and round-trip regressions; reviewer confirmed corrections. Measured 4 x 65 KB inputs took under 15 ms locally; this is not a competitor benchmark.
- Container updated to official Node 24 Alpine digest `sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5` (Node 24.22.3, Alpine 3.24.4), with the same stable branch's vendor `zlib=1.4-r0` fix pinned. Container QA verifies that installed version.
- Alternative security check: actual candidate's 19 Alpine packages mapped by source origin and compared with official v3.24 main/community secfix data using Alpine's version comparator. 154 comparisons found no installed version below the listed fixes. Full evidence: ALPINE_ADVISORY_CHECK.json. This is a scoped advisory check, not a full image/Node-bundled CVE scan or penetration test; Scout still requires sign-in.
- CVE-2026-4738 originally matched zlib's Alpine fix list; OSV describes GDAL's bundled infback9 component. No GDAL/infback9 was found in the original image. The conservative vendor package update was still applied; detection alone did not prove reachable exploitation.
- Existing user changes preserved. No commit, push, tag, release, live Hostinger deployment or real external replay. Remaining v1 gates are listed in RELEASE_READINESS.md.

---

# Readiness continuation — 2026-11-12 14:46 UTC

Scope: local v0.3.0 development build `e656d19e24a2`, not a v1 release or production deployment.

- Added a planned workflow gap: version-1 fixture validation, SHA-256 integrity check, re-redacted preview, and explicit local import. Imports create fresh events without replaying or restoring any destination/history.
- A separate read-only review found a near-limit fixture that passed preview but exceeded import request size. Fixed with a bounded 65 KB fixture envelope while retaining the 64 KB payload cap; regression coverage includes the near-limit case and over-limit rejection. The reviewer confirmed the correction.
- 54/54 Node tests passed, including malformed/version/hash/size/depth rejection, prototype-named keys, preview without mutation, re-redaction and export/import round-trip. Syntax and `git diff --check` passed.
- All three headless Chrome browser suites passed: fixture import, existing Workbench and dashboard. New checks cover cancel, stale preview, edit invalidation, token change, double-click import and 320/390/1440 px layouts. All requests remain local and use synthetic data.
- Workbench and fixture-preview screenshots visually inspected; existing screenshots refreshed from synthetic tests.
- Isolated Docker profile passed again after fixture changes: disabled ingress, no published ports, hardening/non-root, encrypted restart and restoration into a separate disposable volume. No live Hostinger server was contacted.
- Heuristic known-key/token scan of candidate source found no matches. This is not exhaustive secret detection. No runtime npm dependencies. Docker Scout again required sign-in, so there is still no CVE result.
- No version bump, commit, push, release, new remote replay endpoint or hosting change. Exact-final-commit CI and the open product/security/adoption gates in RELEASE_READINESS.md remain outstanding.

The earlier 51-test checkpoint below predates the fixture changes and is not the latest build evidence.

---

# Current working-tree verification — 2026-11-12

Scope: unreleased v0.3.0, runtime-source build `9cab9c6aa8df`. The latest published release remains v0.2.1. These checks cover local changes, not a new public release or deployment.

- 51/51 Node tests passed on Node 25.2.1, including actual loopback TLS and version/build metadata checks.
- Syntax and Git diff validation passed.
- Both browser suites passed using installed Chrome in an isolated headless session. Playwright's expected bundled Chromium was absent; `PLAYWRIGHT_CHANNEL=chrome` now provides a documented alternative without installing software or opening a signed-in profile.
- Dashboard captures, replay history, encrypted restart, retention, filters, keyboard navigation, interrupted requests and 320–1440 px layouts passed. Screenshots were refreshed with synthetic data; the Overview render was visually inspected.
- Isolated Hostinger Compose checks passed after starting installed Docker Desktop: hardened startup, disabled ingress, encrypted persistence across restart and restoration into a separate volume. No Hostinger server was used.
- No commit, push, release or live deployment was performed in this check. Exact-commit CI is still required after these local changes are published.

The historical release verification below remains evidence for v0.2.1 only. Security scan and deployment limitations still apply.

---

# Release verification — 2026-11-11

Scope: v0.2.1, a private single-user developer workbench. A stable tool release is not evidence of a live Hostinger deployment or suitability as a public production webhook gateway.

## Local and isolated sandbox checks

- **42/42 Node tests passed** on macOS Node 25.2.1, with no skips. Coverage includes bearer/origin/Host controls, destination validation, redaction, UTF-8 request chunks, capacity/rate limits, signed ingress freshness/authentication/deduplication, retention, single-use confirmation, and fail-closed storage.
- **Actual HTTPS transport passed**, using an ephemeral local CA and controlled loopback receiver: sanitized JSON delivery, matching attempt correlation headers, valid TLS, rejection of untrusted certificates and hostname mismatch, no redirect following, 64 KB response cap, partial disconnect and five-second timeout. No automatic retries occurred. Test injection permits loopback only in the test harness; production DNS restrictions remain enabled and are tested separately. No external staging service was contacted.
- **Encrypted backup and restore passed**, first into a separate local directory, then from a stopped Docker container into a separate empty named volume. The restored event retains its ID and sanitized contents. Wrong keys fail closed and failed startup releases its own lock.
- **Hostinger Compose sandbox passed**: actual built image, non-root user, read-only root, dropped capabilities, disabled signed ingress, private loopback binding in configuration, encrypted persistence across graceful restart, and separate-volume restoration. Runtime test containers have no network and no published host ports. Disposable resources are removed after tests.
- **Browser regression suite passed** in local Playwright Chromium: unlocking, double-click capture, redaction, compare/export/delete, mobile overflow, cancellation, expiry, repeated replay click, lost response, reload, stale approval after selection change, and stale inbox response after token change. Browser replay uses an injected transport, not a real remote endpoint; the independent HTTPS suite tests real sockets.
- **Redesigned UI verified** at 320, 390, 720, 1024 and 1440 px widths, with labeled controls, 44 px minimum buttons, visible focus styles and keyboard skip navigation. Desktop/mobile screenshots were regenerated and visually inspected.
- **Syntax checks passed** for all four runtime modules. CI actions are pinned by exact commit; the Node 24 Alpine image is pinned by digest.
- **Independent source reviews completed** for auth, persistence, replay/SSRF/TLS and UI races. Review reproduced an approval expiring during POST body receipt; the release rechecks expiry at consumption and includes the regression test. Source review is not an external penetration test or certification.

The final release must also pass its GitHub CI jobs on the exact release commit: Node 22 and 24, hardened container startup, persistent signed ingress/restart, and the Hostinger Compose sandbox. See the repository's Actions tab and the release commit, rather than treating a previous commit's CI as current evidence.

## Security scan limitation

Docker Scout was attempted for the pinned public Node base image. The installed Scout requires Docker authentication and no scan result was obtained. No alternative scanner was installed. This release does not claim a clean CVE scan. Operators should scan the final image using their authorized registry/scanner and keep the pinned runtime updated.

## Boundaries and unverified deployment work

- No live Hostinger deployment, public TLS/proxy/ingress routing, actual-host firewall, backup recovery or external staging integration has been verified.
- A suitable authorized VPS/Docker host is required; PHP/shared hosting is not this runtime. No plan purchase, existing-site replacement or partner-program acceptance is included.
- No native provider signatures, multi-user isolation, encryption-key migration, delivery queue or exactly-once guarantee.
- Replay history has at most 20 attempts per event and 24-hour event retention. Attempt IDs enable receiver-log correlation; no OpenTelemetry, W3C trace propagation or cross-service spans are implemented.
- No load/DoS test, independent penetration test, hardware power-loss durability guarantee or formal security audit is claimed.

Use synthetic data for installation acceptance and review redaction before handling your own integration data. Keep the UI private and do not route production webhook traffic through this debugging tool.
