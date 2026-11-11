# Verification — 2026-11-11

Environment: macOS, Node 25.2.1; official Node 24 Alpine container.

## Passed

- 13/13 Node unit/API/security tests: nested redaction; special/private/metadata/IPv6 addresses; exact HTTPS allowlist; all-answer DNS validation; nested comparison; bearer auth, origin and Host checks; capture/export/delete; single-use confirmed sanitized replay; confirmation expiry and event retention; blocked DNS; unknown delivery/no retry; pinned DNS/no redirects via injected transport; event/request/pending-confirmation limits.
- Syntax checks for server, core and browser JavaScript.
- Playwright Chromium local browser smoke: unlock; repeated capture click; sanitized inspection; second capture and comparison; fixture download; deletion; token change/wrong token; no browser errors; 390px mobile width without horizontal overflow. All non-local browser requests blocked.
- Desktop and mobile screenshots inspected visually.
- Docker Compose configuration validation.
- Docker image build from official Node 24 Alpine.
- Container runtime smoke did not complete: Docker left the isolated test container in `created` state, with no process or daemon error reported. The temporary container was removed. Runtime behavior remains unverified; image build and Compose configuration did pass.

## Not performed

- No real external webhook transmission. Replay transport is covered by injected/mocked transports; a controlled authorized staging integration remains necessary.
- No production deployment, public ingress, load test, penetration test, multi-user test, provider-signature verification or persistence/recovery test.
- Browser replay-confirmation interactions were not exercised end-to-end; confirmation expiry, consumption, blocked destinations and replay outcomes are verified through API tests.
- Inbox capacity/request-rate/approval limits were tested; no stress test of the byte/response/deep-nesting limits.

This records pre-publication local verification. See GitHub CI for checks on the published release commit. No service deployment was performed. The local image remains available as `webhook-replay-lab:local`. No development server is left running; use `npm start` when ready.
