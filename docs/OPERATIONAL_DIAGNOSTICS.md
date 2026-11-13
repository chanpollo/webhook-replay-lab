# Operational diagnostics

`GET /api/diagnostics` is an authenticated **administrator-only** JSON snapshot for the private admin endpoint. Capture and read scoped credentials cannot access it. Keep it behind the existing loopback/SSH access model; it is not a public Prometheus endpoint or permission to expose the admin service. Existing Host/Origin checks and rate limits apply. No additional listener, background poller or outbound request is created.

The response contains a schema version, uptime, memory/encrypted mode and health, fixed capacity limits, retained event/attempt/approval/ingress-receipt counts, retained replay-outcome buckets, and process-lifetime HTTP/replay buckets. It never returns token values, credential IDs, event IDs, payloads, labels, target URLs or failure messages. Categories are fixed rather than derived from user-controlled strings. Storage fail-closed behavior is unchanged: an unhealthy store can return 503 rather than diagnostics.

## How to interpret

- Retained counts reflect bounded records at snapshot time and decrease with deletion/expiry. They are not all-time activity.
- Process counters reset on restart and are not persisted. HTTP request counters include static, health, denied and diagnostics traffic. A diagnostics request is in-flight until its response completes, so its completed status is visible in a later snapshot. Abruptly closed responses count as aborted, not successful delivery.
- Replay counters are updated once after a final retained attempt is saved. Rejected prepare/confirmation requests with no attempt do not increment them. A storage failure before final save can leave a replay out of the process-finalized counters; inspect retained state and recovery records.
- `http_ok` means an HTTP 2xx response, not business processing or exactly-once delivery. `unknown` requires receiver-history investigation, not blind retry. `active` in retained counts is an attempt still validating/sending.
- Diagnostics use the existing retained bounds of 200 events and 20 attempts per event. They do not estimate total payload bytes, memory use, disk capacity, throughput or latency SLA. Counters saturate at the maximum safe JavaScript integer rather than overflow.

This is a minimal in-process operational view, not durable audit history, alerting, an uptime guarantee, DDoS protection or proof of production capacity.
