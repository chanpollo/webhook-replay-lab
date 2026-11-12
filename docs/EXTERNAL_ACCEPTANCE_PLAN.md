# Controlled external HTTPS acceptance plan

Status: prepared, **not executed**. No receiver, tunnel, account, firewall rule or public endpoint has been created by this plan. Current candidate source build: `cf692e61d917`.

## What is actually available

- The connected Mac can run isolated local Docker and browser tests; these pass but are not external-host evidence.
- The inspected dot cloud has Node/Python/curl, only loopback listeners, no installed cloudflared/ngrok/tailscale/caddy and no supported port-exposure tool found. Its current execution restrictions do not provide a ready public receiver.
- Hook configuration has example hostnames only. No owned real Hook staging endpoint or Hostinger instance has been verified.
- Existing corporate SSH aliases belong to unrelated services and are not candidates for this test without separate authorization.

## Concrete options

### A. Existing owned staging receiver (preferred)

Use an operator-designated HTTPS endpoint with a valid public certificate, only public IP answers allowed by the candidate policy, no redirect, port 443, no URL credentials/query/fragment, no production data and no downstream side effects. Obtain the exact URL, ownership, deployment permission and cleanup contact. Do not infer permission from an SSH alias or from being able to connect. This option needs no new tunnel or network-settings change if the endpoint already exists. No such endpoint is currently verified.

### B. Cloudflare Quick Tunnel (proposal only)

Official documentation checked 2026-11-12: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/

The documented `cloudflared tunnel --url http://localhost:8080` exposes a local service through a temporary trycloudflare.com URL without an account/domain. Anyone with the URL can access it; stopping the process ends access. It has no uptime guarantee, a 200 in-flight-request limit and no SSE. Email access authentication is interactive and is unsuitable for this webhook replay flow.

This is **not installed, authorized, or verified compatible** in the current environment. Before any installation or tunnel creation, obtain explicit approval naming Cloudflare, the dedicated receiver, synthetic-only data, public exposure and a maximum 15-minute window. Cloudflare terminates TLS and can process the synthetic request and network metadata. Do not expose the Hook admin UI, credentials, local files or an existing application. Do not accept unanticipated permissions or change security/network settings without the required action-time confirmation.

Preflight must inspect the actual generated hostname's DNS and certificate. The previous candidate rejected every IPv6 answer. The revised candidate validates ordinary-global IPv6 conservatively; any unsafe answer still rejects the entire DNS set. **Do not disable IPv6 checks, pin an invented DNS answer, bypass certificate checks, or weaken SSRF policy to make the test pass.** See `EXTERNAL_HTTPS_ACCEPTANCE.md` for the completed controlled test and verified shutdown.

## Receiver safety contract

Use a new dedicated receiver process bound only to loopback on an unused port, with no filesystem browsing, shell execution, proxying or downstream calls. Accept only one designated POST path and a fixed synthetic fixture shape. Bound body to 4 KB, request time to 5 seconds and total lifetime to 15 minutes. Reject every other route/method. Record only test correlation ID, body digest, receipt time and count, never full headers, credentials or request body. Generate a unique synthetic run identifier to distinguish this run; it is not a production credential. Stop after the test and remove only its own temporary resources. Do not reuse the application admin token for the receiver.

## Acceptance sequence

1. Record approved host, receiver URL, scope, expiry, owner and candidate commit/build/image. Verify empty receiver state and no downstream integrations.
2. Check endpoint DNS/certificate/redirect policy without bypasses. Verify unsupported paths return 404 and no admin service is exposed.
3. Start a separate local Hook instance with empty ephemeral data, a new private session token and exactly this receiver URL in `STAGING_ALLOWLIST`. Never modify a running user's workspace.
4. Import the harmless collection from `examples/orders.collection.json`. Confirm redacted preview and count before import; import must not contact the receiver.
5. Choose one entry, review target and payload hash, then explicitly confirm one replay. Capture the persisted attempt ID and HTTP outcome.
6. Verify receiver receipt exactly once, matching sanitized-payload digest, `Idempotency-Key`/`X-Webhook-Replay-Attempt` correlation and request time. HTTP 2xx alone is insufficient evidence.
7. Verify the app's History/Overview reflect the actual recorded attempt. Export the fixture and run offline verification. Do not claim business delivery or provider-signature support.
8. Stop receiver/tunnel and the disposable Hook instance. Verify the temporary public URL no longer serves the receiver. Remove only generated test resources; preserve minimal non-sensitive evidence.
9. On timeout/unknown delivery, stop and reconcile receipt count before any new attempt. Never automatically retry.

Record pass/fail/blocked for each step. A tunnel test does not establish a Hostinger install, long-running reliability, gateway scalability or human usability.

## Actual-host acceptance

After a particular owned host is authorized, record Docker/Compose version, available storage and resource limits; install in a new project with a dedicated volume; keep admin loopback-only; test SSH forwarding from an authorized client; verify public admin inaccessibility; exercise capture/restart/backup/upgrade/rollback/restore with synthetic data and preserved keys. Confirm shutdown/cleanup and no changes to existing services. The already-passing local sandbox lifecycle test is supporting evidence, not a substitute.
