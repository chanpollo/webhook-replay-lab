# Latest candidate host and external acceptance

Date: 2026-11-12. Exact application commit `c144300e372af061629ef2e73a802b9efb9faa18`, version `0.3.0`, runtime build `98aadcff4fdf`. This is candidate evidence, not a release or production-gateway certification.

## Owned isolated host

The first Compose smoke attempt failed its 30-second healthy wait. No external tunnel was opened in that attempt and cleanup completed. Its original failing health probe details were not retained, so no definitive root cause is claimed. An independent isolated diagnosis showed application `/healthz` HTTP 200, a running non-OOM process and successful Docker health probes.

Repeating the smoke test with a **90-second harness wait** passed the same profile/hardening/nonroot/disabled-ingress/persistence/stopped-backup/restore assertions. Application source and runtime build were unchanged. The test-only wait change permits multiple image healthcheck intervals on slower hosts and does not replace or bypass health checks.

The lifecycle harness also passed fresh installation, v0.2.1 application-source upgrade, rollback reading candidate-created state, re-upgrade and separate-volume recovery. Both versions used the current patched runtime. Network-none containers and no host ports were used. Original container inventory was unchanged and temporary volumes/images/checkouts were cleaned up. This is not an actual Hostinger deployment.

## External HTTPS plus permissions and redaction

Completed `2026-11-12T19:12:46Z` using an approved temporary Cloudflare Quick Tunnel, official release `2026.11.0` with verified asset SHA-256, and an isolated synthetic-only loopback receiver. 15-minute failsafe, 4 KB receiver payload cap and bounded request timeouts. No production/personal data or account credentials were sent to the provider.

- Actual sender DNS: public A and allowed ordinary-global AAAA records; every answer passed policy. Selected transport was IPv4, not an IPv6-only external proof.
- HTTPS readiness: HTTP 200, trusted certificate.
- Admin redaction preview: no stored event.
- Capture role: read denied; read role: capture/preview/prepare/replay denied; capture role: prepare denied. Denied requests returned 403 and receiver had no POST before the admin action.
- Capture applied default masking and configured `$.customer.name` masking before replay.
- Admin explicit prepare/replay: HTTP **204**, **179 ms**, `response_received`, no redirect.
- Receiver: exactly **one** POST, both fields `[REDACTED]`, no Authorization header.
- Attempt and Idempotency-Key: `5da3e2d6-6eee-43d1-9d38-78aacfdcdbfa`, also matched read-role event history.
- Payload SHA-256: `224c77255a68225e5312710f03574b3af5bc04f63cc97ea99c5816646335c884`, matched stored sanitized payload.

## Closure and limits

At `2026-11-12T19:13:01Z`, closed endpoint returned HTTP **530**. No tunnel/receiver processes, temporary directories, test volumes or running containers remained. Only the original SSH listener remained; no firewall, existing services or network settings changed.

Latest exact-candidate CI: https://github.com/chanpollo/webhook-replay-lab/actions/runs/43286516445 . Node 22/24, container/persistence/security passed; 92 local tests and isolated preview browser test passed. CI immutable image `sha256:4babfd643336b4eec021156a10c7fde4ad7dafbe1da50b1011cd8be5a141659a` reported zero known Trivy findings; Node advisory results had no unresolved/unparsed ranges. Local Docker was unavailable during this candidate's local rebuild attempt; do not describe remote CI/host results as a local Docker pass.

Remaining product decisions and independent-human/Hostinger/public-ingress gaps are in RELEASE_ONE_GAPS.md. No new tag/release or permanent endpoint was created by these tests.
