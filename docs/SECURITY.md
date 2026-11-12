# Security boundaries

This tool is for a trusted single-user workstation and synthetic/staging data. Keep it loopback-bound. No credentials or real customer data were used during development.

- Admin data routes require a bearer token; optional ingress requires a separate HMAC signature, constant-time comparison, and a localhost/127.0.0.1 Host header. Cross-origin requests are rejected. The UI uses restrictive CSP, external local assets and textContent rather than HTML interpolation.
- Capture accepts only bounded JSON object/array envelopes; headers are never persisted. Redaction happens before storing a payload. Labels are user-entered metadata: do not place secrets in them.
- Destination URLs must match an operator-configured exact allowlist. Public IPv4 DNS validation is repeated immediately before each request. Mixed public/private answers fail closed. Connections pin the selected IP with the HTTPS hostname retained. No redirects, proxy configuration, production auto-detection or automatic retries.
- One-time confirmations bind an event ID, payload hash and destination and expire. A consumed confirmation is not reusable even after failure. Outbound errors after entering the sending phase are explicitly unknown-delivery.
- Idempotency headers are advisory. A replay can cause side effects even if the HTTP request times out or the server returns an error. This cannot be solved by a checkbox or URL naming convention.
- Limits reduce accidental resource abuse but are not sufficient internet-facing denial-of-service defenses. DNS has a two-second application deadline separate from the five-second HTTP transport deadline. Timing out does not cancel an already-running system DNS lookup.
- Neither memory-only retention nor encrypted snapshots imply secure erasure. OS swap, crash dumps, logs, browser input fields and downloaded fixtures are outside server retention. Never log the session token to shared systems.

Independent source reviews and local negative security tests were performed for v0.2.0; no external security audit or penetration test has been performed. Before public deployment, require an independent review, strong authentication, ingress/egress policy at the network layer, durable encrypted storage, signature adapter design and a separate operational threat model.

The private self-host profiles support opt-in encrypted snapshots and custom signed capture. See SELF_HOSTING.md for mandatory host gates. Signed ingress remains disabled by default and is not approved for production provider traffic. Crypto at rest does not protect against a compromised process/host holding the key.

Replay attempt IDs are persisted before send and forwarded as correlation/idempotency headers. They are not distributed tracing and do not prevent duplicate effects by themselves. CI actions and the base image are pinned; a CVE scan was attempted but blocked by the local scanner login requirement. See VERIFICATION.md for evidence and limitations.

## Latest scoped advisory check

On 2026-11-12 the candidate image moved to the newer pinned official Node 24 image and stable Alpine zlib 1.4-r0 vendor package. Actual installed Alpine package origins/versions were compared against official v3.24 secfix feeds: 19 packages, 154 version checks, no below-fix candidates. See ALPINE_ADVISORY_CHECK.json and VERIFICATION.md. This is not exhaustive image scanning: Node's bundled components, unknown vulnerabilities and runtime reachability are outside that check. No claim of vulnerability-free software.

## Image and Node follow-up (2026-11-12)

Unused npm/npx/yarn tools were removed from the runtime after Trivy detected 19 npm-toolchain advisory instances. The rebuilt image reports zero known findings in Trivy 0.76.2 OS/package scan. Node core advisory ranges were separately compared against 24.22.3, subtracting patched ranges: no unresolved entries. See IMAGE_SCAN.json, NODE_ADVISORY_CHECK.json and VERIFICATION.md for exact scope. This does not certify absence of vulnerabilities, full embedded-library coverage or production readiness.
