# Product hypothesis and scope

## User and job

A small integration team needs to turn a failed test webhook into a sanitized, reviewable fixture and reproduce a staging handler failure without granting a SaaS platform access to the whole production delivery stream.

The proposed wedge is a lightweight staging fixture workbench: capture -> redact -> inspect -> export -> compare -> explicit one-shot replay. This is a product hypothesis, not verified demand, unique capability, or evidence of willingness to pay.

## Competitor context

Reference sources (reviewed 2026-11-11):

- [Hookdeck documentation](https://hookdeck.com/docs)
- [Hookdeck: receive and replay external webhooks in n8n](https://hookdeck.com/webhooks/platforms/how-to-receive-and-replay-external-webhooks-in-n8n-with-hookdeck)
- [Convoy pricing](https://www.getconvoy.io/pricing)

Hookdeck and Convoy already support relevant webhook workflows. Do not claim that capture or replay is novel, that they lack redaction, or that this MVP replaces their reliability, operational tooling, security or support. No pricing comparison is asserted here.

## Why Hostinger might fit

[Hostinger's Open Source Partners program](https://www.hostinger.com/open-source-partners) is the program to review for current eligibility and terms. A VPS could eventually provide an always-on private workspace, but that does not demonstrate customer conversion or program acceptance. The current local MVP deliberately does not expose provider ingress publicly. Do not promote it as an always-on production webhook gateway.

## Validate before expanding

1. Interview 5-10 integration engineers about the last staging webhook bug, existing tools, privacy constraints and actual debugging steps.
2. Ask them to reproduce an issue using sanitized fixtures and measure time to reproduction versus their existing workflow.
3. Learn whether they want fixture versioning/CI assertions or infrastructure-level delivery guarantees. The latter competes directly with established gateways and is not this wedge.
4. Validate a real deployment and security model before offering public inboxes; then evaluate VPS fit and willingness to self-host.

## Deferred work

Per-inbox scoped keys, signature-verification adapters, response/body comparisons, multi-user access, public ingress with a hardened reverse proxy, audit retention and deployment automation. None is implied to exist in this MVP.

## Implemented since the initial hypothesis

Opt-in encrypted persistence, Overview and retained replay history are implemented. The current working tree also validates and previews saved version-1 fixtures before local import. These close parts of the workflow, not the remaining product/adoption, live-host or security gates. See [release readiness](RELEASE_READINESS.md).

Portable collections and the explicit CI fixture CLI are now in the working tree; usage and limitations are in FIXTURES.md. Adoption, server deployment and security gates remain unpassed.
