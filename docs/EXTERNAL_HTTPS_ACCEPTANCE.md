# Controlled external HTTPS acceptance — 2026-11-12

## Candidate identity

- Source base: `1c23f2899bdf42bacf24de171b9370dbbfc3be78`, plus reviewed IPv6 policy changes.
- Runtime source fingerprint: `ea172c04549a` (version remains unreleased `0.3.0`).
- Transferred source/synthetic-fixture archive SHA-256: `862f617c67835ed849ddb0afefb595c74ea1cdcda6f7a475cd872789ef75662f`, verified on the isolated owned host.
- Probe diagnostic incorrectly passed a filesystem path instead of a URL to `readBuildInfo`, printing `unknown/unavailable`. This is a probe error, not proof of a runtime metadata defect. Correct default invocation on matching local source produced the fingerprint above. Archive integrity was independently verified remotely.

## Method and scope

User-approved free temporary Cloudflare Quick Tunnel, official `cloudflare/cloudflared` release `2026.11.0`, binary verified against the official GitHub release asset SHA-256. Isolated loopback receiver; exact synthetic fixture only, 4 KB input limit and request deadline, 15-minute termination failsafe. No production payloads, credentials or existing service configuration were sent or changed. No firewall, DNS or ingress configuration changes. The external provider saw only synthetic fixture data and generated test correlation identifiers.

Actual sender DNS returned both public IPv4 and ordinary-global IPv6 records. All were validated before the candidate preferred an IPv4 connection. This proves dual-stack hostname acceptance with a pinned IPv4 send, not an external IPv6-only transport test. Real IPv6-only socket/TLS behavior is separately covered by isolated loopback tests.

## Results

At `2026-11-12T18:52:27Z`:

- HTTPS readiness GET: HTTP 200, certificate authorized.
- Real candidate API: fixture import → explicit prepare → replay → event history.
- Replay: `response_received`, HTTP **204**, **106 ms**, no redirect.
- Attempt ID: `88234766-f5e5-44af-a25e-84e8b8898ad6`.
- Exactly **one** receiver POST; attempt header and Idempotency-Key matched that ID and candidate history.
- Payload SHA-256 matched fixture: `ddf4864782298110577d4551d4d479e1f3184ba96638de3adf69230affa50992`.
- No automatic retry, fallback or policy bypass.

The earlier IPv4-only candidate correctly blocked this dual-stack class of endpoint and delivered zero POSTs; the new behavior follows a separately reviewed conservative IPv6 policy, not a special-case bypass for Cloudflare.

## Cleanup

Verified at `2026-11-12T18:52:39Z`: tunnel/receiver/failsafe stopped, temporary binary/source/archive removed, no test containers or temporary directories remained; original host still exposed only its existing SSH listener. The old tunnel URL returned HTTP **530**, not the receiver. No permanent deployment or public release was created.

## Remaining scope

This acceptance covers one controlled external replay and correlation, not production capacity, business processing guarantees, Hostinger installation, or real-human usability acceptance. Local suite: 66/66 passed, syntax and diff checks passed. Remote CI for the revised source still needs to run before release.
