# Hook roadmap: Release 1 and beyond

Updated 2026-11-13. This is a delivery roadmap, not a completion percentage, release announcement or guarantee of Hostinger acceptance. It preserves the original objective: a useful webhook-debugging product that other developers can adopt, with clear UI and a credible Hostinger distribution path. Passing a private single-user test does not satisfy that objective by itself.

## Product outcome

An integration developer can **receive an authenticated test webhook, retain a sanitized record, understand the failure, create a reproducible fixture and explicitly replay it to owned staging**, without forwarding production credentials or needing to understand the implementation. A small team can share appropriate capture/read access and operate the installation predictably.

The current Release 1 engineering target includes a reviewed, opt-in receiver for supported test integrations, durable bounded storage and an installable operator experience. The admin interface stays private. This is more than a private-only demonstration, but it is **not** a production delivery gateway: automatic delivery retries, exactly-once claims, transparent production forwarding and multi-tenant hosting are not silently included.

Public exposure, provider credentials, hosting purchases, program agreements and formal release creation remain separate authorization steps. Planning them here does not authorize performing them.

## Baseline: shipped versus candidate

| State | What can be claimed |
| --- | --- |
| Published stable | **v0.2.1** is the latest published release identified by the project. Install its tag for that release; do not describe newer main-branch features as shipped in it. |
| Verified, unreleased runtime candidate | **v0.3.0**, runtime build **98aadcff4fdf**, application source `c144300`. Includes fixture collections/import/export, explicit replay CLI, configurable additive redaction/preview, scoped capture/read credentials and doctor. Documentation/harness-only commits followed; inspect the exact selected revision's CI. |
| Verified evidence, not universal readiness | 92 tests; Node 22/24 and container/security CI; owned-host isolated lifecycle/recovery; controlled external HTTPS replay with matching single receipt, masking and permission denials; closed temporary endpoints; agent-operated fresh install. See [latest acceptance](FINAL_CANDIDATE_ACCEPTANCE.md) and [fresh-install simulation](FRESH_INSTALL_AGENT_WALKTHROUGH.md). |
| Not demonstrated | Independent human usability, live Hostinger install, program acceptance/referral revenue, permanent public receiver isolation, production capacity/SLA, provider-native signature adapters, team/tenant isolation. |

## Current work after the verified baseline

Operational diagnostics, ingress hardening and the Stripe test-mode adapter passed source `083ceed` unit/API and isolated proxy CI, separately from the earlier baseline above. Actual Stripe account delivery and public TLS acceptance for this runtime remain unverified. The generic HMAC receiver and private default remain distinct from any newly tested public receiver profile.

## Release 1 milestones

Milestones may overlap where dependencies permit. Continue engineering toward the receiver/store/explicit-staging-replay target without waiting on optional scope questions. Dates should reflect actual access dependencies; elapsed time or a renamed package is not acceptance evidence. Numerical targets below are **proposed acceptance criteria**, not measured results.

### R1.1 — Finish the repeatable debugging workflow

**Current:** core capture → redact → inspect → export/import → compare → explicit staging replay is implemented and technically exercised.

**Engineering added:** a session-only task guide for preview/capture/export/import/compare, with explicit staging and unknown-delivery instructions; automated browser acceptance is separate from human task evidence.

**Remaining work:** independent task validation for first capture, preview, fixture portability and uncertain delivery; error messages with a next action; final desktop/mobile/accessibility review. Keep charts derived from real retained records and distinguish HTTP response from business success.

**Exit evidence:**
- A fresh checkout completes the documented flow with no undocumented setup steps; attach exact build and test output.
- Browser tests cover preview edits/navigation/session change, cancelled/expired confirmation, duplicate click, retention expiry and unknown-delivery handling.
- Three developers unfamiliar with the tool independently complete capture, export/import, compare and safe replay on a controlled receiver; record task completion and assistance. Proposed gate: no unresolved critical task failure; at least two complete first capture/export within 15 minutes. An agent simulation does not count as a human participant.

**Dependencies:** core runtime exists; human participants and a separately authorized receiver session are needed for the final observation.

### R1.2 — Receive supported test integrations safely

**Current:** generic signed ingress exists; the private VPS profile deliberately disables it. Public reverse-proxy example is not a verified public deployment. Current replay does not preserve original provider signatures.

**Build:**
- A separate opt-in receiver profile exposing only authenticated capture routes, never admin/read/replay routes.
- An initial **Stripe test-mode** native verification adapter, plus the documented generic HMAC protocol. Stripe live-mode compatibility is not implied. Verify the original raw body before sanitization; do not disable provider verification to make a replay work.
- Clear provider setup, key rotation and dedicated staging replay-adapter guidance. Unsupported providers must say unsupported rather than claim compatibility.
- Request size/time limits, signature timestamp/event handling, bounded deduplication and abuse budgets. Do not equate bounded deduplication with exactly-once delivery.

**Exit evidence:** owned test sender → HTTPS receiver → sanitized durable event → explicit staging replay → matching receipt, on the exact release candidate. Negative tests must reject bad/expired signatures, altered raw bytes, duplicate/out-of-window cases as documented and oversized/slow requests. Public admin and unknown routes must be inaccessible. Independent threat-model review has no unresolved critical/high finding.

**Dependencies:** authorized Stripe test-mode sandbox account/session and its correct signing secret. A [local CLI delivery test](STRIPE_LOCAL_TEST.md) can proceed without public DNS/TLS or registering a public URL when that session is available. Approved owned DNS/TLS/exposure remains a separate prerequisite for public receiver acceptance. Develop adapters and negative fixtures offline first; do not open an endpoint as a side effect.

### R1.3 — Storage, access and recovery that operators can trust

**Current:** encrypted bounded snapshots, expiry, scoped capture/read access, restart-based rotation and isolated backup/restore/upgrade/rollback are implemented. Credentials share one inbox; there is no tenant boundary. Stricter redaction rules fail startup on incompatible retained data.

**Build/finish:** a documented retention/capacity contract; [offline stricter-redaction migration](REDACTION_MIGRATION.md) now creates a verified copy while preserving the source, resetting labels and removing historical attempts from the copy; recovery and credential-rotation diagnostics; a minimal redacted security-event record if pilot operators need an audit trail. Decide explicit audit retention/access before implementation. An offline key-copy command now preserves the source, validates and reads back a separately encrypted destination; see [rotation](STORAGE_KEY_ROTATION.md). Local tests do not replace per-route cutover/rollback acceptance.

**Exit evidence:** failure-injection tests for interrupted writes, wrong key, corrupt snapshot, stale/live locks and restart during replay; recovery preserves the documented outcome or fails closed. Old rotated tokens fail, unaffected principals still work and forbidden operations remain denied. Recovery instructions work on an empty authorized host without deleting the original volume. Document what exports/backups retain after expiry or deletion.

**Dependencies:** no new public ingress needed for implementation; actual-host recovery uses a separately isolated workspace.

### R1.4 — Observable and bounded operation

**Current:** health endpoint, bounded records/requests and synthetic capacity/abuse regressions exist. These are not throughput, endurance or DDoS evidence.

**Build:** secret-free operational metrics now have a [local loopback alert probe](ALERTS.md) for service/storage errors/capacity, repeated signature failures and unknown replay outcomes; external notification delivery and an assigned responder remain operator acceptance; installation diagnostics; supported runtime/image patch policy; an operator owner and response/runbook.

**Exit evidence:**
- Declare the reference hardware, test dataset, configured limits and workload mix before measurement.
- Run an authorized isolated 30-minute test within documented limits and a short over-limit phase; measure p50/p95 latency, error/429 rates, CPU, memory and disk behavior. Proposed success: no crash, uncontrolled growth or silent data loss; over-limit work fails in the documented bounded way. Set a latency budget from the intended workload, not an invented benchmark.
- Verify alerts and recovery with fault injection; no credentials/payloads in logs or metrics.
- Final immutable image and Node advisory gates pass with raw artifacts; independent security review and operational tests remain distinct from a clean scanner.

**Dependencies:** dedicated test resources and an agreed service envelope. Do not load-test shared production or the user's other workloads.

### R1.5 — Customer installation and Hostinger distribution

**Self-host delivery target:** one OCI image with supported Docker/Compose, Kubernetes and compatible Hostinger VPS deployment routes. Kubernetes packaging passed actual disposable kind 1.37 acceptance for source `083ceed`; actual customer CNI/CSI, backup/restore and operational acceptance remain open. Publish only an approved registry/release artifact, with version tag, immutable digest, source revision/build identity and retained scan evidence. Do not use `latest` as the only identity or embed installation credentials.

**Per-route acceptance:** install from empty state, synthetic capture, graceful stop/restart, one-writer upgrade/rollback, secret permissions, private admin/optional receiver isolation, and isolated backup restore. For Kubernetes additionally verify actual CSI/Secret behavior, no overlapping writer during replacement, resource/probe behavior and network controls. A manifest lint or local Docker success is not Kubernetes acceptance. Image platform support must match tested architectures; no multi-architecture claim from a single-platform build.


**Current:** public MIT repository, README/screenshots, Node/Docker packaging and owned-host sandbox evidence exist. No actual Hostinger installation or program approval is claimed. PHP/shared hosting is not interchangeable with this Docker VPS profile.

**Build/finish:** supported-host preflight, secure secret provisioning, explicit lifecycle/backup commands and install troubleshooting; a template compatible with the actual Hostinger program flow if accepted. Keep the private admin model and reviewed receiver boundaries intact rather than weakening them for a template.

**Exit evidence:** a new operator installs the exact candidate and performs synthetic capture, restart, upgrade and restore using only the instructions. For a **Hostinger-tested** claim, repeat on an explicitly authorized Hostinger environment and record runtime/network/storage checks. For a **one-click** claim, verify the real template and secret-provisioning flow, not a placeholder button.

**External gates:** program application/review, applicable agreement and actual approved deployment/referral code/link. Confirm eligibility, attribution and payout terms from current official sources. No commission percentage, catalog listing or earnings is guaranteed. A source release may be independent of program acceptance, but the two statuses must remain visible and separate.

### R1.6 — Evidence-based launch

**Required before a Release 1 label:** complete the receiver/store/explicit-staging-replay launch contract and applicable R1 milestones above, accept an explicit list of deferred features and known limits, review the exact diff for secrets/customer data, and require green CI on the final tag commit. Include tested install/rollback guidance, version/build, supported integrations and evidence links in release notes.

Record human task results and findings from the original plan's 5–10 integration-engineer interviews. Validate that the workflow solves a recurring problem and compare reproduction steps/time with participants' existing tools. Do not claim market parity, faster performance or demand without the corresponding evidence.

Formal release creation must respect its outstanding authorization boundary. No public endpoint, paid plan or external submission is implicitly approved by a green build.

## Sequence and parallel work

1. Preserve the verified candidate as the baseline; continue opt-in receiver, durable store and explicit staging replay work, using Stripe test mode as the first native provider alongside generic HMAC.
2. Continue onboarding, diagnostics, migration/recovery design and offline adapter/security fixtures in parallel.
3. With explicit access/exposure approval, validate receiver isolation and supported provider end to end.
4. Complete reference-load/operations and new-operator/human walkthroughs; fix findings, then rerun affected gates.
5. Complete exact release CI/review and authorized publication. Track Hostinger application, installation and catalog/referral acceptance separately.

## After Release 1

| Direction | Trigger and dependency | Acceptance before claiming support |
| --- | --- | --- |
| More provider adapters | Repeated pilot demand; sandbox credentials and provider semantics understood | Positive/negative signature corpus, rotation and replay-adapter tests per provider; no blanket “all webhooks” claim |
| Fixture workflow automation | Users need reproducible regression assertions | Versioned schemas/collections, explicit CI assertions and safe artifact review; compatibility and migration tests |
| Better team collaboration | Shared-inbox limits are demonstrated by users | Designed roles/workspace ownership, audit access, revocation and isolation tests; SSO/tenant support is a separate capability |
| Richer analysis | Users need response/schema comparisons or longer history | Explicit retention/privacy model, bounded indexing/storage, redaction of captured response data and accessible visualizations |
| Production delivery gateway | Customer evidence justifies a distinct reliability product | Durable queue/outbox, retry/backoff/dead-letter behavior, idempotency semantics, ordering/partition decisions, capacity/failover/restore testing, abuse control, operational SLO and security review. Do not retrofit automatic replay without an explicit product/safety contract. |
| Hosted service or marketplace expansion | Validated demand, support economics and distribution terms | Tenant isolation, billing/privacy/legal/support model, credential lifecycle and audited deployment; independent of an open-source source release |

## Decisions to settle, not infer

- Supply or authorize only the external resources actually required for final receiver validation: controlled Stripe test-mode account/keys and owned DNS/TLS/exposure. The first provider and engineering direction are already selected; offline adapter and negative tests should proceed without waiting.
- Choose the approved Hostinger validation/application path and resource owner; do not purchase a VPS automatically.
- Agree the operator/service envelope and human pilot participants, then approve the formal release when its evidence and boundaries are clear.

Related: [original plan](../PLAN.md), [product hypothesis](PRODUCT.md), [readiness](RELEASE_READINESS.md), [remaining gaps](RELEASE_ONE_GAPS.md), [Hostinger boundaries](HOSTINGER.md).

## Latest engineering checkpoint

Source `083ceed`, runtime `58f35f208f9b`: 129 tests and full image/proxy/security/disposable-kind CI passed; a checksummed amd64 image artifact exists. [Evidence](SELF_HOST_ACCEPTANCE.md). This closes the initial Docker/image and disposable Kubernetes execution checks, not customer CNI/CSI acceptance, real Stripe account delivery, public TLS validation for this build, human usability or formal publication.

## Recovery/operations engineering follow-up

See [current checkpoint](R1_RECOVERY_CHECKPOINT.md) for exact local/CI evidence and open gates. Offline migrations, local alerts and automated onboarding do not replace real receiver, human, Hostinger or approved publication acceptance.
