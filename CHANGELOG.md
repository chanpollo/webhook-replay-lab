# Changelog

## 0.1.0-alpha.1

Experimental first local release.

- Add private memory-only JSON capture, redaction, fixture export and comparison.
- Add explicitly confirmed staging replay with an exact URL allowlist and pinned public-IPv4 HTTPS transport.
- Block private/metadata destinations and redirects; do not retry automatically.
- Add responsive UI, security/resource limits, tests and Docker packaging.
- Document product assumptions, known limitations and development milestones.

Known limitations: memory-only storage; no public provider ingress; no original provider signatures or authorization forwarded; pattern-based redaction is not DLP; real staging network replay has not been exercised; local container runtime smoke was blocked by Docker startup. Follow the exact release's CI results for container validation status. Not production-ready.
