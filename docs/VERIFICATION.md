# Release verification — 2026-11-11

Scope: v0.2.0, a private single-user developer workbench. A stable tool release is not evidence of a live Hostinger deployment or suitability as a public production webhook gateway.

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
