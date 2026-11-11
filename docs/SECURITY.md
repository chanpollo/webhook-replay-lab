# Security boundaries

This tool is for a trusted single-user workstation and synthetic/staging data. Keep it loopback-bound. No credentials or real customer data were used during development.

- All data routes require a bearer token, constant-time comparison, and a localhost/127.0.0.1 Host header. Cross-origin requests are rejected. The UI uses restrictive CSP, external local assets and textContent rather than HTML interpolation.
- Capture accepts only bounded JSON object/array envelopes; headers are never persisted. Redaction happens before storing a payload. Labels are user-entered metadata: do not place secrets in them.
- Destination URLs must match an operator-configured exact allowlist. Public IPv4 DNS validation is repeated immediately before each request. Mixed public/private answers fail closed. Connections pin the selected IP with the HTTPS hostname retained. No redirects, proxy configuration, production auto-detection or automatic retries.
- One-time confirmations bind an event ID, payload hash and destination and expire. A consumed confirmation is not reusable even after failure. Outbound errors after entering the sending phase are explicitly unknown-delivery.
- Idempotency headers are advisory. A replay can cause side effects even if the HTTP request times out or the server returns an error. This cannot be solved by a checkbox or URL naming convention.
- Limits reduce accidental resource abuse but are not sufficient internet-facing denial-of-service defenses. DNS uses the operating-system resolver, whose resolution deadline is not the five-second HTTP transport deadline.
- Memory-only retention is not secure memory erasure. OS swap, crash dumps, logs, browser input fields and downloaded fixtures are outside server retention. Never log the session token to shared systems.

No security audit or penetration test has been performed. Before public deployment, require an independent review, strong authentication, ingress/egress policy at the network layer, durable encrypted storage, signature adapter design and a separate operational threat model.
