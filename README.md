# Webhook Replay Lab

A dependency-free, local-first staging debugger: capture JSON, sanitize it, export a reproducible fixture, compare payloads, and explicitly replay once to an approved staging endpoint.

**Release status (checked 2026-11-13): [v0.2.1](https://github.com/chanpollo/webhook-replay-lab/releases/tag/v0.2.1) is the latest published release. The main-branch candidate targets v0.3.0 and is unreleased.** The candidate includes fixture/collection import and export, explicit replay CLI, configurable redaction with preview, scoped capture/read credentials and operator diagnostics. It is a shared-inbox staging workbench, not a public webhook delivery gateway.

## Documentation

- [Install and platform support](docs/INSTALL.md)
- [Verified image artifacts](docs/CONTAINER_IMAGE.md) and [Kubernetes self-hosting](docs/KUBERNETES.md)
- [Release 1 roadmap](docs/ROADMAP.md), [engineering acceptance](docs/R1_ENGINEERING_ACCEPTANCE.md), [fresh exact-9a088a4 CI](docs/EXACT_SOURCE_CI.md) and [private release packet preparation](docs/RELEASE_PACKET.md)
- [Fixtures and explicit replay CLI](docs/FIXTURES.md)
- [Redaction rules](docs/REDACTION.md) and [offline migration](docs/REDACTION_MIGRATION.md) and [shared-inbox credentials](docs/SCOPED_CREDENTIALS.md)
- [Operational diagnostics](docs/OPERATIONAL_DIAGNOSTICS.md), [local alerts](docs/ALERTS.md) and [capacity/fault contract](docs/CAPACITY_REFERENCE.md)
- [Provider ingress and staging limits](docs/PROVIDER_INGRESS.md)
- [Self-hosting, backups and recovery](docs/SELF_HOSTING.md) and [offline storage-key rotation](docs/STORAGE_KEY_ROTATION.md)

### Verified candidate evidence

**Fresh checkpoint verification:** source `9a088a4`, build `e764835f4f8d`, was actually checked out in every job of [run 43395140386](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43395140386), with 147 tests, all platform/security/browser gates and a new full 30-minute workload passing. Its workflow definition is `fe24b7a`; the separate identities and six checkout guards are [retained explicitly](docs/EXACT_SOURCE_CI.md). Separate automated reviews found four P2 issues in new packet tooling; all were fixed and [re-reviewed](docs/INDEPENDENT_REVIEW_9A.md). Packet preparation does not publish an image or approve Release 1.

**Recovery/operations follow-up (isolated branch, unreleased):** source `fae063f`, build `e764835f4f8d`, passed 147 tests on Node 22/24, five browser suites, Docker install/upgrade/rollback/restore, image/security, disposable kind and a full 30-minute native reference workload. [Exact evidence, measurements and remaining gates](docs/R1_ENGINEERING_ACCEPTANCE.md); [CI run 43389359288](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43389359288). The image is a checksummed Linux amd64 CI artifact retained for 14 days, with no registry publication, Hostinger verification or v1 release. For these follow-up features explicitly select commit `fae063f4fc2a4d03223ee9c528125020662bf703` from branch `codex/r1-recovery-operations-20261113`; main remains a separate earlier candidate.

**Earlier main self-host candidate:** source `083ceed`, runtime `58f35f208f9b`, passed 129 tests, Docker/proxy/security and real disposable Kubernetes acceptance. A checksummed Linux amd64 image artifact is available from [CI run 43350428884](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43350428884). See [exact self-host evidence and limits](docs/SELF_HOST_ACCEPTANCE.md). This is not a registry publication or v1 release.

**Earlier external receiver milestone:**

Runtime build `98aadcff4fdf` passed 92 tests, Node 22/24 CI, container/security checks, owned-host isolated install/upgrade/rollback/recovery and controlled external HTTPS replay. The receiver recorded one matching, redacted request with no forwarded Authorization header; scoped capture/read tokens could not replay. Temporary receivers were closed afterward. See [exact candidate acceptance and cleanup](docs/FINAL_CANDIDATE_ACCEPTANCE.md).

[Fresh-install walkthrough](docs/FRESH_INSTALL_AGENT_WALKTHROUGH.md) covers native Node setup, CLI fixture verification and encrypted restart; it is an agent-operated simulation, **not human usability evidence**. The documented runtime was last verified on [source b7104f9 and its CI](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43288579641); inspect the CI for your chosen revision rather than assuming every later checkout passed. No live Hostinger deployment, partner-program approval, permanent public ingress or v1 release is claimed.

## Screenshots

Three focused views: Overview, Replay history, and Workbench. These screenshots document the recorded candidate layout and may not show every subsequently added control. Screenshots use actual locally recorded **synthetic** captures and injected replay outcomes, not customer traffic or an external staging integration. No real customer data or usable credentials are shown. Charts in normal use derive only from retained server records; the app does not seed demo metrics.

![Retained activity overview](docs/desktop-preview.png)

<details>
<summary>Replay history and selected-event investigation</summary>

![Searchable replay attempt history](docs/history-preview.png)

![Selected-event payload and retained attempts](docs/workbench-preview.png)

</details>

<details>
<summary>Mobile layout (390 px)</summary>

![Mobile retained activity overview](docs/mobile-preview.png)

</details>

## Start

First obtain a checkout and enter its directory:

```sh
git clone https://github.com/chanpollo/webhook-replay-lab.git
cd webhook-replay-lab
git checkout v0.2.1
```

This installs the published stable version, **not** all candidate features described below (including fixture/collection CLI, custom redaction, scoped credentials and doctor). For the unreleased development candidate, explicitly check out `main` instead and verify its CI and build ID. A main-branch checkout is not a published stable release.

Requires a supported Node.js version 22 or newer (CI: Node 22/24; pinned container: Node 24).

```sh
npm start
```

Open http://127.0.0.1:4319 and paste the session token printed in your terminal. No dependency installation required. Do not share this token or redirect logs to a shared location. The token is generated per process unless `LAB_TOKEN` is supplied. Keep the terminal running; Ctrl-C stops the lab and discards its memory.

1. Unlock the inbox and open **Workbench**. The follow-up candidate also provides **Open capture workbench** in its first-run guide.
2. Capture the clearly labeled synthetic order; in the candidate, preview redaction first.
3. Inspect the redacted JSON and export its fixture.
4. Change the synthetic amount, capture a second event, then compare it with the first.
5. Delete events you no longer need.

Default storage is **memory-only** (the self-hosted profiles use encrypted snapshots): restart loses all events, confirmations and attempt records. Export needed fixtures. Expired events are inaccessible after 24 hours and swept from memory at most 30 seconds later. Exported files are outside this retention policy; delete them yourself. No raw request headers are retained.

## Version and build

The footer shows the package version and a 12-character SHA-256 identifier of the shipped runtime source files, captured at server startup. The same source produces the same build ID locally and in Docker; edits change the ID after restart. It is a source identifier, not a release tag, timestamp or container digest. No Git checkout or build environment variables are required. Missing inputs show `build unavailable`; an unreadable version shows `vunknown`.

## Investigate with real retained data

- **Overview:** last-hour or last-24-hour capture/replay-start counts, 12 time buckets, outcome distribution, unknown deliveries, and median recorded HTTP-response latency. Open the accessible chart table for exact timestamps and counts. Every figure uses the server snapshot time; **Refresh data** is manual, not a live stream.
- **Replay history:** search event labels/IDs, attempt IDs, and destinations; filter unknown, non-2xx, blocked, 2xx, or active outcomes. It uses replay start time, independent of the original capture time. The initial list shows 20 attempts with a Show more control. Open any result directly in Workbench.
- **Workbench:** searchable capture inbox, redacted JSON, fixture export, payload comparison, and this event's newest-first attempt timeline. History includes target, time, HTTP code, recorded latency, error and correlation ID when available. Only explicitly confirmed replay can send a request.
- **Honest outcomes:** HTTP 2xx means a response was received, not that business processing succeeded. A timeout/interrupted transport can be **unknown delivery**, not a safe-to-retry failure. Review receiver logs with its attempt ID first. Missing latency is shown as unavailable, not zero.
- **Persistence:** no new history database is required. Existing optional encrypted snapshots preserve records across restart; default memory-only mode does not. Events expire 24 hours after capture, with at most 200 events and 20 retained attempts per event. Deletion, expiry and caps remove records from counts. This is **not a complete audit log**. Synthetic samples you capture count as real records in this workspace and remain visibly labeled.

Tab navigation supports keyboard arrows, Home/End, and view-only URL hashes with Back/Forward. Tokens and payloads are never saved to browser storage or the URL. A failed refresh clearly marks the older snapshot.

See [dashboard design, verification and bounded performance measurements](docs/DASHBOARD.md) for scope and remaining gaps.

## Import a saved fixture

In Workbench, open **Import fixtures**, paste an exported version-1 JSON fixture, and choose **Validate & preview**. The server checks the payload hash, version, shape, nesting and size, then applies redaction again. Review the sanitized preview before **Import event**. A hash proves integrity of the supplied JSON representation, not trust or origin. Free text still needs review.

Import creates a fresh local event with no destination, credentials or replay history. It never sends a webhook. Unsupported versions, added metadata and mismatched hashes are rejected. Sanitized payloads remain limited to 64 KB; fixture requests allow 65 KB to include version/hash metadata and confirmation. Inbox limits still apply. Editing the JSON, cancelling, or changing the session invalidates the preview. Do not paste production secrets merely to test redaction.

Collections and CI: see [portable fixtures and explicit CLI replay](docs/FIXTURES.md), including a synthetic example, machine-readable outcomes and no-retry behavior.

## Optional staging replay

Only enable an endpoint that you own and have confirmed is isolated staging with harmless test credentials and test downstream integrations. The program cannot prove an environment is staging. An allowlisted production URL would still be dangerous.

```sh
STAGING_ALLOWLIST='https://your-confirmed-staging.example/webhooks/test' npm start
```

Comma-separated exact HTTPS URLs are accepted. No query strings, fragments, URL credentials, IP literals, or ports other than 443. Do not put secrets in URL paths. Each replay requires reviewing the destination and payload hash and typing `SEND TO STAGING`; confirmation expires after 60 seconds and is consumed before network activity. There are no automatic retries. Inspect an unknown-delivery result at the destination before considering another attempt.

All DNS answers must pass the public IPv4 or conservative ordinary-global IPv6 policy. Any unsafe answer rejects the whole set. Validated IPv4 is preferred on dual-stack hosts; IPv6-only targets pin the validated IPv6 address. The selected address and family are pinned to the TLS connection while the original hostname remains the certificate/SNI authority. Special/private/metadata, mapped, translation, transition and scoped addresses fail closed. There is no automatic address fallback after a send. See `docs/IPV6_POLICY.md` for excluded ranges and limitations. Redirects are reported but never followed. DNS has a two-second deadline; the request has a five-second transport deadline and a 64 KB response limit; response bodies and headers are not stored. Each replay attempt ID is persisted before sending and transmitted as both `Idempotency-Key` and `X-Webhook-Replay-Attempt`. Use that ID to find an uncertain attempt in receiver logs. A new attempt gets a new key; receiver support is unknown and this is **not** a guarantee against duplicate effects.

Replay sends only sanitized JSON and newly generated minimal headers. It does not forward authentication, cookies or original provider signatures. This may intentionally break a provider-specific signature check. Use a dedicated staging adapter; do not disable verification on a production endpoint.

## Private capture API

The inbox is not a publicly accessible provider URL. A local integration test may submit JSON with the same session token:

```sh
curl http://127.0.0.1:4319/api/events \
  -H "Authorization: Bearer $LAB_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"label":"Synthetic test","payload":{"type":"test.event","value":1}}'
```

For this example, start the server with `LAB_TOKEN` set to your own randomly generated value of at least 32 characters. Do not use a real customer payload before reviewing redaction limitations.

## Container

```sh
export LAB_TOKEN="$(openssl rand -hex 32)"
docker compose up --build
```

Compose publishes **only 127.0.0.1:4319**, uses a non-root user, read-only filesystem, dropped capabilities and resource limits. It has no persistent volume because the inbox is deliberately ephemeral. Never change the published address to a public interface without a separate security design and authorization. A remote VPS requires SSH forwarding for the private UI. The optional receiver supports generic HMAC and an opt-in Stripe test-mode adapter; see the provider ingress guide. No permanent public service deployment is claimed; isolated owned-host acceptance is documented separately.

## Hostinger VPS

Use the dedicated private persistent profile in [the Hostinger guide](docs/HOSTINGER.md). It keeps the UI behind SSH forwarding, disables signed ingress, and uses a Docker-managed volume containing encrypted snapshots. This is a VPS/Docker path, not PHP shared hosting or a public managed web app. Hostinger deployment and partner-program approval are **not verified**. The desktop and mobile screenshots above show the current private workbench.

## Checks

Tests require Node.js 22+, Git, zip/unzip and OpenSSL on PATH (for a temporary local TLS certificate). Release collector tests use a fake local GitHub CLI and ZIP fixtures without network access. Tests use synthetic data; the HTTPS transport tests never contact an external endpoint or weaken production destination validation.

```sh
npm test
npm run check
npm run doctor       # Reads current environment only; does not load .env or probe the network
npm run test:capacity # Bounded synthetic loopback checks, not a throughput benchmark
LAB_TOKEN=synthetic-config-validation-token-000000 docker compose config --quiet
```

Optional browser QA uses an existing Playwright installation:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test/ui-smoke.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test/dashboard-smoke.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test/dashboard-performance.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test/fixture-ui-smoke.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test/redaction-ui-smoke.mjs
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test/onboarding-ui-smoke.mjs
```

If the bundled Chromium version is absent, set `PLAYWRIGHT_CHANNEL=chrome` (or `msedge`) to use an already-installed browser in an isolated headless session. This does not use your signed-in browser profile or download a browser. Omit the variable to use Playwright’s bundled Chromium.

The browser test blocks all non-local requests. It covers unlocking, repeated capture clicks, sanitization, comparison, fixture download, deletion, token-change handling, mobile overflow and browser errors. The dashboard suite also checks encrypted-history restart, filters, exact metric values, retention, stale snapshots, token clearing and responsive views. Run it last to regenerate all four screenshot files in `docs/`. The separate performance script is synthetic and makes no competitor-speed claim.

See [v1 release readiness](docs/RELEASE_READINESS.md) for the current unpassed gates.

## Limits and honest boundaries

- 64 KB ordinary inbound JSON and each sanitized payload; fixture envelopes allow 65 KB and collection envelopes 257 KB (256 KB sanitized collection); 200 events; 120 permitted authenticated API requests/minute per credential (one admin plus at most 16 scoped credentials); 600 non-static public/unauthorized/forbidden requests/minute shared budget (private UI assets and health checks are exempt); 100 pending confirmations; 20 retained attempts/event; one replay start per five seconds.
- Default redaction uses sensitive field-name matching and email/Bearer patterns; optional restricted JSONPath rules add masking and cannot disable defaults. Recognized credential fields include CVV/CVC, PIN/OTP/TOTP, JWT, private keys, session IDs, account/routing numbers, IBAN, recovery/backup codes, access/signing/encryption keys and security answers, including common camelCase and separator variants. It is not DLP and cannot guarantee removal of arbitrary personal data, secrets in free text, labels or unusual schemas. Review exported fixtures and replay content manually.
- Payload comparison reports at most 200 differing paths; it is not a schema-aware or response-body regression runner. Missing values are marked separately from explicit null; own-property checks handle prototype-named fields.
- One shared inbox with an admin token and optional capture/read roles; no tenant or per-user event isolation, SSO, general-purpose RBAC, scheduling or delivery queue. Optional AES-256-GCM snapshots retain bounded attempt history, not a comprehensive audit log.
- Generic signed ingress and an opt-in Stripe test-mode adapter; live-mode Stripe and other native providers are unsupported. No outbound authentication or guarantee of exactly-once delivery.
- This is a bounded developer tool, not a hardened internet-facing security product. See [security notes](docs/SECURITY.md), [product hypothesis](docs/PRODUCT.md), and [verification](docs/VERIFICATION.md).

## License

MIT. See [development plan](PLAN.md) and [changelog](CHANGELOG.md). No service deployment is included.

## Operator checks and access

Run `npm run doctor` before startup for read-only configuration diagnostics (no network probe or secret output). See [onboarding diagnostics](docs/ONBOARDING_DIAGNOSTICS.md).

Optional [scoped credentials](docs/SCOPED_CREDENTIALS.md) grant capture-only or read-only access to the same inbox; they are not tenant isolation. Rotate by replacing the private configuration and gracefully restarting. Optional [redaction rules](docs/REDACTION.md) add restricted JSONPath masking to default redaction. Use **Preview redaction** before capture. Stricter rules fail closed on incompatible retained payloads instead of silently exposing them.
