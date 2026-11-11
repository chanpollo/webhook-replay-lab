# Development plan

## Release policy

The first release is `v0.1.0-alpha.1`, an experimental local developer tool. Passing tests does not establish internet-facing safety or production readiness. Use synthetic data first. Never present this release as a durable webhook delivery gateway.

## Phase 0 — Local alpha

- [x] Private token-authenticated JSON inbox and responsive inspection UI.
- [x] Redacted fixture export and bounded payload comparison.
- [x] Exact staging allowlist and single-use replay confirmation.
- [x] DNS pinning, private-address restrictions, redirect blocking and no automatic retries.
- [x] Memory retention and resource limits.
- [x] Unit/API security checks, local browser smoke, Docker packaging and operating documentation.
- [x] CK review completed; UTF-8, obvious-secret field coverage and oversized-body regression findings addressed.
- [ ] Argon review or explicit owner-approved deferral; reviewer identity/integration remains unresolved.
- [x] Node 22/24 and hardened container runtime CI pass on the reviewed code revision.
- [ ] Reconfirm CI on the exact final tag commit before publishing the alpha release.

## Phase 1 — Reproducible staging workflows

Goal: a teammate can reproduce a sanitized failing webhook without forwarding production secrets.

- JSON fixture import with version/hash validation and a clear preview.
- Fixture collections and stable event metadata suitable for Git.
- CI-friendly replay runner with explicit staging configuration and machine-readable outcomes.
- Schema-aware diffs that distinguish missing, null and type changes.
- Browser tests for replay review, cancellation, expiry, repeated send and navigation interruption.

Exit criteria: one documented end-to-end test against an owned, explicitly authorized staging endpoint; fixtures contain no real personal data; replay confirmation and duplicate-prevention tests pass. No promise of exactly-once delivery.

## Phase 2 — Security and retention hardening

- Independent threat-model review and adversarial URL/DNS/redirect tests.
- Bounded DNS resolution and strict total deadlines.
- Configurable JSON-path redaction with preview and test corpus; document free-text limits.
- Scoped inbox credentials and explicit secret rotation.
- Evaluate encrypted persistence, expiry/deletion semantics, local backups and a redacted audit log.
- Pin deployment images and dependencies with an update policy.

Exit criteria: accepted threat model, reviewed egress controls, tested restore/expiry behavior, and no unresolved critical/high findings. Do not add multi-tenant claims without isolation testing.

## Phase 3 — Self-hosting pilot

- Validate a private single-user VPS install through SSH forwarding.
- Add health checks, upgrade/rollback documentation and basic operational metrics.
- Only consider public provider ingress after separate authorization, authentication/signature design, ingress/egress policy, abuse limits and an independent review.
- Assess provider-specific staging signature adapters without disabling production verification.

Exit criteria: controlled pilot with documented failure recovery and an owner who understands retention and replay side effects. Hostinger deployment is optional, not assumed.

## Product validation

Interview 5–10 integration engineers, observe their last staging failure, compare reproduction time with existing tools, and test whether fixture workflows solve a recurring problem. Hookdeck and Convoy already cover relevant webhook workflows; differentiation and willingness to self-host remain hypotheses. Program eligibility or sponsorship is not promised.

## Not planned for this alpha

Production delivery guarantees, transparent production traffic proxying, payment/webhook side-effect suppression, automatic replay, unrestricted destinations, public anonymous inboxes, SSO/RBAC or multi-tenant hosting.
