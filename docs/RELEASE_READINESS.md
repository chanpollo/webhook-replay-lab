# v1 readiness

Checked 2026-11-12. **Not v1 release-ready.** The source candidate can be reviewed independently of a formal release. No v1 tag or permanent live deployment is claimed; temporary owned-host acceptance and controlled external replay are documented separately.

## Product contract to preserve

A useful product for other integration developers: capture, inspect, safely reproduce a staging failure, navigate real history, and install/recover it with clear instructions. Hostinger compatibility is a supported self-hosting path, not proof of live deployment or partner acceptance. No speed, market-parity or security certification claim without measured evidence. If the required product is a production delivery gateway, queueing/retries/provider signatures/multi-user/operations below are substantial implementation work, not optional caveats to hide in release notes.

## Gates

| Area | Evidence | Remaining work |
| --- | --- | --- |
| Capture/export/compare/replay | Local API and real controlled TLS tests | Controlled external HTTPS replay passed with exactly one matching receipt/hash/attempt; see EXTERNAL_HTTPS_ACCEPTANCE.md. This is not production delivery assurance. |
| Fixture portability | Version/hash validation, sanitized preview and explicit import now implemented and tested locally | Collections, offline CI verification and explicit single-fixture replay CLI implemented locally; controlled external staging test passed; exact final CI passed for 0b2812635a149f013037c15f9a34f5380c47f1ff |
| UI/history | Real retained records, filters, charts, keyboard/responsive tests, version/build | Documentation-only fresh-user review corrected stable/candidate and CLI setup gaps; real fresh-user task walkthrough and final visual acceptance remain; no competitor usability or speed result |
| Persistence/recovery | Encrypted restart, fresh installation, v0.2.1-source upgrade/rollback/re-upgrade and separate-volume recovery tested in isolated Docker (both versions use the current patched runtime) | Owned Linux host sandbox installation/upgrade/rollback/restore now passed (REMOTE_HOST_ACCEPTANCE.md); temporary external receiver acceptance passed; permanent public deployment and actual human client access remain unverified |
| Security | Negative auth/SSRF/TLS/redaction/expiry tests; no runtime npm dependencies | Official Alpine advisory comparison of rebuilt candidate completed with no below-fix candidates (19 packages / 154 comparisons), zlib vendor fix applied. Scout still requires login; Trivy image scan and Node core advisory comparison now supplement this check; see VERIFICATION.md for final findings and coverage limits. Independent source review of the IPv6 change found no new blockers; comprehensive third-party security review remains |
| CI/release | Prior public main CI passes; revised candidate full local suite 66/66 passes | Candidate source 0b2812635a149f013037c15f9a34f5380c47f1ff is published; exact Node 22/24 and container/security CI passed (run 43284751197). Formal release authorization and final product acceptance remain separate. |
| Hostinger | Private Docker profile, no public ingress; isolated profile checks | No actual Hostinger install/TLS/host recovery verification; shared PHP hosting cannot run this Node/Docker profile |
| Operations and product scale | Strict limits and manual refresh | No production queue/retry, native provider adapters, tenant isolation, complete audit retention or load/DoS evidence |
| Market/adoption | Product hypothesis and competitor references exist | Fresh-user evidence and comparative workflow measurements; do not claim parity or faster performance |

## Publication and deployment boundary

Before publishing a release, verify the exact candidate contains no credentials or customer data, passes CI and accurately describes remaining limitations. A source update is not a formal release. Do not send traffic to an unapproved staging endpoint or purchase hosting as a side effect of validation.

## Validation commands

- `npm test` and `npm run check`
- `PLAYWRIGHT_MODULE=<installed playwright index.mjs> PLAYWRIGHT_CHANNEL=chrome node test/fixture-ui-smoke.mjs`
- Repeat with `test/ui-smoke.mjs` and `test/dashboard-smoke.mjs`
- `npm run test:hostinger` uses isolated temporary Docker resources, no external requests or host ports, and cleans up only its own test resources.

Do not route production webhook traffic through this staging debugger to demonstrate readiness.

- `node test/lifecycle-smoke.mjs` builds historical v0.2.1 application source on the current patched runtime and exercises upgrade/rollback/recovery using disposable isolated volumes. It requires the current `webhook-replay-lab:release-candidate` image. It is not evidence about an old release image or a live host.
