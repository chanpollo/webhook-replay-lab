# Release 1 customer-readiness review

Reviewed against PLAN.md, PRODUCT.md, README and HOSTINGER.md on 2026-11-12. A successful replay is a technical milestone, not a substitute for the original adoption and Hostinger goals. No roadmap criterion is waived here.

## Verified foundation

Candidate `c144300` / runtime `98aadcff4fdf`: 92 local tests, Node 22/24 CI, hardened container/persistence, isolated lifecycle/recovery, independent source review of the IPv6 change, known-advisory image/Node checks, and one controlled external HTTPS replay with a single matching receipt. The temporary endpoint is closed. No live product deployment or new formal release exists.

## Concrete unfinished work

| Customer need | Present behavior | Remaining implementation or evidence |
| --- | --- | --- |
| Deploy without specialist assistance | Docker Compose + hand-generated secrets + SSH forwarding | Observe a fresh developer completing the documented flow; reduce documented failure points; validate the exact Hostinger template/secret provisioning flow before claiming one-click |
| Receive real provider webhooks | Generic signed ingress exists, disabled by default in VPS profile; example proxy untested | Independently review and test public-route isolation, abuse/rate limits, clock/replay defenses and provider signature adapters; do not expose admin endpoints |
| Safely share within a team | Single administrator token and one local inbox | Capture/read roles and restart-based rotation now implemented for one inbox; richer team access model still requires design; no SSO/tenant claims |
| Control redaction | Key heuristics plus conservative text scrubbing | Restricted JSONPath rules and real preview now implemented with adversarial tests; full JSONPath is intentionally unsupported and free-text limitations remain |
| Operate over time | Fixed retention/limits, encrypted storage, manual recovery | Operational alerts/metrics, documented support/patch owner, capacity/abuse measurements and recovery exercises; encryption-key migration is not implemented |
| Trust usability and market fit | Automated browser checks, real charts/history, hypothesis and competitor references | Independent human task walkthrough, visual acceptance, and comparative workflow measurement; no parity/speed claims without evidence |
| Install from Hostinger catalog and receive referral revenue | Public MIT repository and VPS-compatible profile | Actual program review, approved deployment/referral link/code and applicable agreement; no catalog acceptance or earnings guarantee |

## Decisions that cannot be inferred from code

1. **Product launch contract:** release a staging fixture workbench first, or require a public always-on webhook receiving service for the first customer launch? The original roadmap distinguishes these. A private-only technical test must not silently become the product definition. A public service adds ingress/provider/abuse/operational work; a production delivery gateway additionally requires durable queues/retry semantics and is a larger product.
2. **Hostinger route:** validate compatibility on owned hardware and apply to the program first, or additionally provision an actual authorized Hostinger VPS for customer-install acceptance? Do not purchase hosting automatically or invent program credentials/approval.
3. **Formal publication:** source push and green CI do not resolve any pending confirmation for creating the GitHub release. Use exact tested source and honest release notes when that boundary is resolved.

Implemented locally after this review: additive JSONPath redaction/preview, capture/read credentials with restart rotation, read-only doctor, and bounded loopback capacity/abuse tests. Exact runtime candidate CI and repeated owned-host/external acceptance passed; see FINAL_CANDIDATE_ACCEPTANCE.md. These results do not establish production throughput or human usability. Task-based onboarding and operational evidence can continue. Final decisions above determine which implementation blocks v1 versus later milestones; do not mark them complete by renaming the version.
