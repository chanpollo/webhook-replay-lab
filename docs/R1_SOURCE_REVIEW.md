# Recovery and operations source review — 2026-11-13

Scope: the diff from `9f3d86b` adding offline copies, private alerting, task onboarding and capacity/fault harnesses. Performed by the implementing agent using the `engineering:code-review` security/correctness/performance checklist. This is **not independent human threat review**, a penetration test or evidence that an internet-facing deployment is safe.

## Findings addressed

| Finding | Impact | Resolution/evidence |
| --- | --- | --- |
| A transient failed pre-send snapshot commit could enter the ordinary replay catch path and later return 200 | A caller could mistake storage failure for a usable recorded outcome | Storage-unhealthy replay now throws to the 503 path immediately; failure injection at validating/sending/final commits verifies send counts and durable restart outcomes |
| Case-only hex key changes represented the same AES key | Operator could believe rotation changed key material | Compare hex keys case-insensitively and reject equivalent keys; regression assertion covers uppercase/lowercase input |
| Missing fields from an older/partial diagnostics schema could suppress a signal | Probe could report healthy despite missing signature/error counters | Require all signal fields to have valid bounded numeric/boolean shapes; unsupported/incomplete diagnostics yield a fixed unavailable alert |

No further critical/high issue was identified in this scoped self-review. The independent receiver/deployment threat-model gate remains open.

## Boundaries checked

- Offline commands create no listener or outbound request. Source and destination use existing exclusive locks, private ownership/permissions, regular-file checks, authenticated bounded decryption and atomic fsync-based writes. Sources are not saved by the copy commands; existing destinations and alias paths fail. Untrusted concurrent directory writers remain unsupported. A failed copy can leave a destination for inspection; automatic deletion/replacement is intentionally absent.
- Stricter-redaction copies strip labels, replay history and extension metadata while preserving IDs/times and bounded ingress receipt evidence. Defaults cannot be disabled. Original encrypted snapshots/backups still contain old history; unknown deliveries must be investigated there before replay. There is no secure-erasure or DLP claim.
- Local alerts accept only loopback HTTP bases, reject redirects, bound response bytes and time, require admin diagnostics, and print fixed codes/actions. No server errors, payloads, signatures, URLs, token values or filesystem paths are interpolated into CLI failure output. Counter resets, missed polls and external notification ownership remain explicit limitations.
- Onboarding uses textContent and existing same-origin API paths; it adds no browser storage, telemetry or outbound replay. Token changes/reload clear progress. Counts describe session actions, not human task acceptance.
- Crash tests target only child processes and private temporary directories. Endurance accepts no target URL and uses a dedicated CI runner, bounded workload/duration and exact retained-ID checks; it does not test a shared production/Hostinger host.
- No runtime dependency was added. Test-only Playwright is locked with package integrity hashes and installed with scripts disabled. Its npm audit reported no known findings; exact image/Node advisory checks remain separate CI gates. Source token-pattern checks found no real credential matches; committed fixtures/screenshots/logs are synthetic.

## Remaining operator/security acceptance

Verify actual host/CSI filesystem durability, stopped-writer cutover and rollback, notification supervision/responder ownership, current immutable image scan evidence, public receiver route isolation and supported-provider delivery on an explicitly authorized environment. Formal release, registry publication and Hostinger acceptance remain separate from this review.
