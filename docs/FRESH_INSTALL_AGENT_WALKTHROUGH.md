# Agent-operated fresh-install walkthrough

Reviewed 2026-11-12 at source commit `39bed378586c285db34eb4e442f0479b85d5bd13`. This is an automated agent simulation from a new empty temporary checkout, **not an independent human usability session** or evidence of market fit.

The walkthrough followed the documented candidate/native Node workflow. No dependencies were installed; Docker was not started. All app requests used an unused loopback port, an empty staging allowlist and synthetic payloads. Generated token/key/config files stayed in a private temporary directory and were never printed or transmitted externally.

Passed:

1. Read-only doctor accepted the matching private configuration and did not output the token.
2. Started a fresh process with a configured token file and alternate loopback port.
3. Custom plus default redaction preview returned masked values without storing an event.
4. Captured a synthetic event, exported a fixture and verified it with the actual offline CLI.
5. Captured a second amount, confirmed comparison differences, then previewed/imported the exported fixture.
6. Gracefully stopped and restarted with the same encrypted store/key; all three events remained and the lock was released at stop.
7. Deleted one event and verified two remained. The encrypted snapshot did not contain the original synthetic sentinel.
8. Stopped the process and removed only the generated temporary workspace.

No replay was sent, no public listener or provider endpoint was opened, and no production data was used.

Documentation fixes found during this walkthrough:

- Distinguish shared-server external API acceptance from the CLI's existing loopback/injected-transport coverage.
- Add explicit native Node persistence setup: `.env` is not auto-loaded, the data directory must belong to the current user (not blindly UID 1000), token/key files must match startup, and ports must not collide with existing work.
- Remove outdated blanket claims that no external staging acceptance has occurred while retaining the lack of live Hostinger deployment.

Still unobserved: a real new user independently finding controls, selecting a version, provisioning secrets, understanding retention and safely recovering without assistance. Do not mark the human acceptance checklist complete from this simulation.
