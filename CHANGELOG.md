# Changelog

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
