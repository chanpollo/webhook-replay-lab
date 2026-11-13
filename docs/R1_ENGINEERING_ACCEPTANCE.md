# Release 1 engineering acceptance — 2026-11-13

**Tested application source:** `fae063f4fc2a4d03223ee9c528125020662bf703`, runtime build `e764835f4f8d`, unreleased package `0.3.0`. [CI run 43389359288 passed every job](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43389359288). Work is on `codex/r1-recovery-operations-20261113`; main was checked unchanged at `9f3d86b`. No v1 label, formal release, public receiver, registry publication or actual Hostinger deployment is implied.

The subsequent evidence/documentation commit changes no shipped runtime input. This acceptance applies to the exact source/image below; a future release tag must pass its own required CI and remaining product gates.

## Executed acceptance

- **147/147 tests on Node 22 and 24**, syntax checks and portable collection verification; local Node 22.14.0/24.15.0 also passed. Coverage includes source-preserving offline key/redaction copies, wrong-key/lock/destination rejection, interrupted writes/fsync, pre/post-send failed commits and restart recovery, direct-loopback proxy bypass, secret-file permissions and Stripe fresh-signature retry dedup across encrypted restart.
- Five browser suites passed: replay/confirmation, fixtures, redaction, onboarding and dashboard. They cover cancelled/expired review, duplicate clicks, stale responses, token changes, retention expiry, unknown delivery, keyboard tabs and 320–1440 px layouts. Screenshots use synthetic captures/injected outcomes; no independent human task acceptance is claimed.
- Hardened Docker capture/restart, private Hostinger-compatible Compose backup/restore and isolated reverse-proxy route tests passed. No host ports or external delivery were used in those container tests.
- Exact-image offline redaction → different-key copy → stricter-policy boot → local alert probe → original path/key rollback passed. Original ciphertext was preserved during the offline copies; service startup normally rewrites authenticated snapshots.
- Upgrade → rollback → re-upgrade and separate-volume recovery passed from pinned `v0.2.1` application source `8f803f01a14b378edd27653bd5f900b19ff099f2`. Both source versions used the current patched base runtime; this does not certify the historical release image.
- The saved/scanned image was loaded into disposable **kind 1.37**. UID/private secret copies, encrypted PVC restart, private ClusterIP/port-forward, authentication and disabled ingress passed. The temporary cluster was removed. Default kind CNI does not establish NetworkPolicy enforcement or customer CSI durability.

Raw successful summaries: [CI extracts](evidence/r1-final/acceptance-extract.txt). Full job logs and downloadable image remain attached to the linked CI run; artifacts expire after 14 days.

## Full 30-minute reference workload

Actual reference: native Node **24.22.2**, Linux x64 dedicated GitHub runner, **4 CPUs / AMD EPYC 7763**, 16,759,439,360 bytes host RAM. Runtime source/build match the image, while the image's Node **24.22.3** was tested separately for container lifecycle/security. This is not a 30-minute container or Hostinger benchmark.

Predeclared workload/budgets are in [capacity reference](CAPACITY_REFERENCE.md). Actual elapsed time **1,800.003 seconds**, 20 initial retained synthetic events, 1 KB field, roughly one request/second, followed by 150 over-limit reads at concurrency eight. CPU/RSS include service and local driver.

| Measurement | Steady | Over limit |
| --- | ---: | ---: |
| Requests | 1,796 | 150 |
| p50 | 1.219 ms | 4.100 ms |
| p95 | **3.084 ms** | 8.613 ms |
| HTTP 5xx | 0 | 0 |
| HTTP 429 | 0 | **51 (34%)** |
| Intended bad-signature 401 | 180 | 0 |

Steady p95 passed the unchanged **250 ms** budget. Maximum sampled combined RSS was **108,335,104 bytes (~103.3 MiB)**, below 256 MiB; maximum snapshot size **24,530 bytes**. CPU: 3,209,913 user + 501,880 system microseconds. There were 61 resource samples. Stopped-writer reopen matched all **20** expected retained event IDs; one snapshot file remained. No crash, unexpected status or acknowledged-record loss was observed in this workload. [Raw measurements](evidence/r1-final/endurance.json).

The earlier short Mac smoke budget failure remains recorded in [the engineering checkpoint](R1_RECOVERY_CHECKPOINT.md); no budget was relaxed. These measurements do not establish maximum-payload capacity, external replay latency, endurance beyond 30 minutes, public abuse resistance, a customer SLA or market-speed claims.

## Exact image and advisory evidence

- Linux **amd64 only**, tag `webhook-replay-lab:0.3.0-fae063f4fc2a-amd64`.
- Scanned/loaded image ID: `sha256:12c6d94873bbbd00c6aeb9ce0ac5d659962a6bc375a532cff3f35c795511291d`.
- Docker-save gzip archive SHA-256: `0284faa7a426033414ad16cd5506db38fd4dd198769aee0b0bcee202663e3673`. Downloaded archive checksum was independently checked locally.
- **0 Trivy known findings**; Node **24.22.3** advisory comparison has **0 unresolved / 0 unparsed** entries. Raw [Trivy](evidence/r1-final/trivy.json), [Node result](evidence/r1-final/node-core-result.json), [feed](evidence/r1-final/node-core-feed.json), [image inspection](evidence/r1-final/image-inspect.json) and [build identity](evidence/r1-final/build.json) are retained here. This is database/time-scoped evidence, not vulnerability-free certification.

The image ID is not a published registry manifest digest; the archive is not an OCI-layout tar. See [load/verification instructions](CONTAINER_IMAGE.md). No ARM64 or permanent public distribution is claimed. Retain the archive before CI artifact expiry or publish only to an approved registry with the proper source/digest evidence.

## Gates still open

- Authorized real Stripe sandbox/session; the [CLI local-listener path](STRIPE_LOCAL_TEST.md) requires no public HTTPS. No CLI/session was available here, and no real account events were created.
- Separately approved public TLS/isolation and owned staging replay on this exact runtime; independent receiver/deployment threat review.
- Human first-use tasks/interviews, actual operator cutover/restore on the supported customer host/CSI, and a designated monitoring/notification responder.
- Actual authorized Hostinger environment and install/lifecycle/network/storage verification; program/catalog/referral acceptance remains separate.
- Approved permanent registry destination/visibility and formal release authorization, final tag CI and all applicable [roadmap](ROADMAP.md) gates. The scope is unchanged; this engineering checkpoint does not complete Release 1.
