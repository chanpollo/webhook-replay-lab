# Private operational alerts

Run the local probe as the operator, using an administrator token in a private secret file:

```sh
export LAB_TOKEN_FILE=/private/secrets/admin-token
node bin/alerts.mjs
node bin/alerts.mjs --watch
```

Default base: `http://127.0.0.1:4319`. `LAB_ALERT_BASE` may select another loopback port, including the local end of an existing SSH tunnel. Only HTTP with the literal `127.0.0.1` host and no credentials, path, query or fragment is accepted. Redirects are errors. No external alert destination, mail, chat message, public listener or notification account is created.

The probe uses the existing admin-only diagnostics route, a five-second deadline and a 16 KB response cap. JSON output has only `ok`, fixed alert codes and fixed corrective actions. Exit 0 means no current signal, 1 means an alert/unavailable service and 2 means invalid configuration. In watch mode it waits 60 seconds after each probe before the next; the process remains running. Stop with Ctrl-C. An operator can explicitly configure their own local service supervisor to collect this output and route notifications. **Someone must own that supervisor and response; this repository does not appoint a responder or guarantee alert delivery.** Keep the service and tunnel healthy, and never share token files or enable shell tracing.

| Code | Trigger | Response |
| --- | --- | --- |
| `service_unavailable` | Timeout, unavailable/unauthorized diagnostics, redirect, oversized/invalid response or unsupported schema | Check process/tunnel, health, credential role and storage; preserve state before recovery |
| `storage_unhealthy` | Diagnostics reports unhealthy storage | Stop writes and follow recovery instructions; do not replace/delete the source |
| `event_capacity` | At least 180 of 200 retained events | Review retention, export reviewed fixtures or delete unneeded records before more captures |
| `receipt_capacity` | At least 1,800 of 2,000 ingress receipts | Review traffic/abuse and allow the bounded receipt window to elapse; do not bypass dedup |
| `signature_failures` | At least 10 rejected signed-ingress authentications since the previous successful sample | Check sender clock/key setup and receiver isolation; never log signatures |
| `unknown_delivery` | Any retained unknown-delivery attempt | Inspect destination logs using the retained attempt ID before another send |
| `server_errors` | Any completed HTTP 5xx since the previous successful sample | Inspect private health/storage and recover before replay |

The first sample uses process-lifetime counters; watch mode uses deltas, handles counter rollback and retains its previous baseline across failed probes. Counters reset on restart and are not a durable audit record. Fixed-window request budgets and the five-second body limit still apply. A persistent capacity/unknown signal repeats on each successful poll; there is no automatic acknowledgement, suppression, retry or remediation. A restarted service between samples may lose counter evidence; neither polling nor a healthy result proves absence of incidents.

Tests verify signature-failure instrumentation, role denial, capacity/unknown/recovery signals, bounded responses, local destination enforcement and sanitized failure output. These tests do not prove external notification delivery or public receiver security.
