# Read-only onboarding diagnostics

Run `node bin/doctor.mjs` from the reviewed checkout using the same already-configured environment as the intended Node process. It prints JSON check IDs/statuses and generic corrective actions. Exit 0 means no configuration-shape failures; exit 2 means invalid configuration or invocation. Warnings still require operator review.

The command does **not** load `.env` automatically, start a server, contact destinations, invoke Docker, decrypt a snapshot, alter keys, create a lock or change settings. Do not use `docker compose config` without `--quiet` or paste expanded environment variables into logs merely to run diagnostics. For Compose, the shell and container environment can differ: this command is not proof of the rendered Compose configuration.

Checks: optional Stripe test-mode signing secret using the runtime reader/verifier (one source only, private owned non-linked regular file up to 4 KB when file-based, persistent storage required, exposure still unverified), optional `LAB_REDACTION_PATHS_FILE` (regular non-symlink JSON up to 16 KB, same restricted-path validator as runtime), optional `LAB_SCOPED_TOKENS_FILE` using the same runtime validator (private regular JSON, at most 16 KB and 16 unique capture/read entries, no duplicate/admin-matching tokens), supported Node major, admin token format, persistent-storage key format, signed-ingress prerequisites, exact staging URL shape, port and container-binding warning. Referenced secret files must be regular non-symlink files, owner-only (no group/other permission bits), and at most 4 KB for this diagnostic. Values, paths, URLs and exception details are never included in reports. Missing/unreadable files produce a generic failure. A scoped-credential file without a configured admin token is validated using a fresh temporary token; the actual generated startup token does not exist yet, so comparison with it is not proven by this diagnostic. File ownership, random entropy, key uniqueness, actual existing data/key pairing and live network exposure still need separate verification.

No configured token warns that normal startup will generate a session token. Memory-only mode and an empty replay allowlist are legitimate local defaults but explicitly warned about. A valid config is **not** a security certificate, a successful backup restore, or readiness to expose the admin interface.

## Bounded capacity/abuse checks

Run `node --test test/capacity.test.js`. The harness creates only ephemeral loopback in-memory servers with synthetic data, no replay destinations and no external calls. It closes its own sockets/timers on completion. It exercises:

- 600 rejected public requests, then budget rejection; the authenticated budget remains available.
- 120 authenticated requests, rejection above the window limit, and simulated-clock recovery.
- 200-event capacity followed by rejection without silently evicting retained events.
- 32 concurrent synthetic captures with unique records and redaction preserved.

These are deterministic functional bounds, not a public load test, DDoS defense, production capacity number, latency SLA or market-speed comparison. Fixed-window advancement avoids waiting a real minute but does not model a real sustained workload. Public ingress capacity, multi-process behavior, slow clients and prolonged resource saturation need their own approved isolated test plan.
