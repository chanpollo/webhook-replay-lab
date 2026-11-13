# Synthetic reference workload and fault contract

This is a declared acceptance envelope for a **dedicated disposable CI runner**, not permission to test a shared VPS, Hostinger account or production service. No remote URL is accepted. The service binds an ephemeral loopback port and uses a new private temporary directory and synthetic encrypted snapshot; cleanup touches only those resources.

`node test/endurance.mjs` defaults to 1,800 seconds. The CI `endurance` job uses its own Ubuntu runner and records actual Node version, CPU model/count and host memory before measurement. Reference configuration: one Hook process plus its local driver, 20 initial retained events, approximately 1 KB synthetic payload fields, 200-event/64 KB payload limits, 120 authenticated requests per minute, no replay targets. Combined driver/service RSS budget is 256 MB and local steady p95 response budget is 250 ms, selected for this low-rate developer workflow rather than a public SLA.

One request per second repeats a ten-step mix: two captures, two deletions, five reads and one intentionally rejected signature. Every read checks exact retained IDs and masking. The final five seconds include 150 reads at concurrency eight, requiring 429 rejections. The process remains alive for the full configured duration. Both phases record status counts and p50/p95 latency; CPU user/system microseconds, RSS, snapshot size and 30-second samples accompany them. Disk snapshots must remain within the 32 MB storage bound. A stopped-writer reopen must match all acknowledged retained records. Failure aborts acceptance rather than relabeling a short run as endurance.

For harness development only:

```sh
LAB_ENDURANCE_SECONDS=10 node test/endurance.mjs
```

This does **not** count as the 30-minute gate. `LAB_ENDURANCE_OUTPUT` can save the synthetic JSON report. CI retains reports/logs for 14 days; archive the exact accepted artifact before expiration. The workload does not exercise external replay latency, long retention, maximum payload storage, DDoS saturation, multi-process scaling or a customer filesystem/CNI/CSI. No no-growth conclusion can be drawn about those scenarios.

`test/recovery-faults.test.js` separately kills a child writer during a partial temporary write, after temporary fsync and after rename; a directory-fsync error exercises uncertain commit. Restart must authenticate a complete old or new generation; stale locks remain until the test confirms that child exited. Replay tests inject failed durable commits before validation, before send and after send: failed writes return 503; transport cannot start before its sending state is durable; restart distinguishes blocked from unknown delivery without retry. These are process/filesystem-call faults, not power-loss, disk-controller or network-volume durability proofs.
