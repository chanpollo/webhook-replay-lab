# Hostinger VPS compatibility

This profile packages the **private developer workbench** for a Linux VPS with Docker Engine 28 or newer and Docker Compose 2.24.4 or newer. It has not been deployed on Hostinger or accepted into Hostinger's developer program. It is not an automatic public webhook service. Do not replace an existing website.

## Language and hosting choice

Keep the existing dependency-free JavaScript (ES modules) backend and browser UI, running on Node.js. The container pins Node 24 Alpine; CI also checks Node 22. There is no framework migration or compilation step. TypeScript can be introduced incrementally later if the codebase grows; it is not a Hostinger requirement.

Use **VPS + Docker Compose** for this profile. Managed Node.js Web Apps and PHP/shared hosting are not interchangeable with a Docker VPS. This tool relies on a private loopback admin endpoint, SSH forwarding and durable local encrypted storage. Do not relax its Host/Origin checks or expose the UI to make a managed-host deployment work.

## Install on an authorized VPS

1. Choose an already authorized VPS with Docker Engine 28+ and Compose 2.24.4+ installed. Check `docker version` (Server) and `docker compose version` first. Older Docker engines can expose localhost-published ports to neighboring hosts on the same network; loopback publishing alone is not sufficient on those versions. Purchasing a plan, configuring SSH access or changing a firewall are separate operator actions. Do not open port 4319 to the internet.
2. Clone this public repository and check out `v0.2.1`. This published version does not include the unreleased fixture/collection CLI features. Candidate testing requires the explicitly reviewed local checkout, not this stable tag. Keep the checkout path and Compose project name stable on upgrades.
3. In the checkout, create a new private `.env` (mode 600) with independently generated random `LAB_TOKEN` (32+ characters) and `LAB_STORAGE_KEY` (64 hexadecimal characters). `openssl rand -hex 32` can generate each independently. Leave `STAGING_ALLOWLIST` empty. Do not overwrite an existing key or paste credentials into shared terminals, tickets, logs or version control. Back up the key separately from the data. Docker administrators can read environment variables.
4. Run `docker compose -p webhook-replay-lab -f compose.hostinger.yaml config --quiet`. Do not print/share expanded configuration because it contains secrets.
5. Run `docker compose -p webhook-replay-lab -f compose.hostinger.yaml up -d --build` and then `docker compose -p webhook-replay-lab -f compose.hostinger.yaml ps`.
6. From your own computer, run `ssh -N -L 127.0.0.1:4319:127.0.0.1:4319 user@your-owned-vps`. Open http://127.0.0.1:4319 and unlock using your token.
7. Capture synthetic installation-test data, stop/start the service, and verify the same sanitized record remains. Confirm the VPS port is not publicly accessible and complete the applicable acceptance checks in [SELF_HOSTING.md](SELF_HOSTING.md).

The profile initializes a Docker-managed named volume from the image's `/data` directory, owned by the non-root container user. This avoids manual host bind-directory ownership setup. It does **not** import data from `compose.pilot.yaml`. Do not switch an existing pilot expecting its data to appear automatically. Verify a backup and plan migration separately.

Signed ingress is explicitly disabled in this profile, even when `LAB_INGRESS_KEY` is present in the shell or `.env`. Staging replay remains disabled until an operator deliberately configures `STAGING_ALLOWLIST`. The service has a read-only root filesystem, dropped capabilities, no-new-privileges, bounded memory/processes and no automatic restart after failure. A crash lock requires investigation; do not blindly restart or delete locks.

## Backup, recovery and upgrades

Stop the service gracefully before backup. Use `docker compose -p webhook-replay-lab -f compose.hostinger.yaml cp lab:/data/inbox.enc /your/private/backup/inbox.enc` to copy the stopped container's snapshot into an existing private backup directory. Protect the backup file (mode 600) and store its encryption key separately. Test restoration in an isolated matching-version environment before relying on a backup. Keep the previous image/tag and backup together for rollback.

`docker compose ... down` preserves the named volume; **never use `down --volumes` or prune this volume unless you intend to destroy the stored inbox**. Removing or changing the project name can make existing data appear missing. The encrypted state and key must remain paired. Follow the lock, unknown-delivery, retention and key-rotation limitations in [SELF_HOSTING.md](SELF_HOSTING.md); there is no automatic encryption-key migration.

## Local verification

Run `npm test`, `npm run check` and `npm run test:hostinger` with Docker available. The Hostinger smoke test uses an isolated disposable Compose project, synthetic credentials, no published ports and no external container network. It verifies the real profile's loopback binding, non-root hardening, disabled ingress, synthetic capture, and encrypted named-volume persistence across a graceful restart. It removes only its generated test resources. It also copies an actual stopped-container encrypted backup and restores it into a separate empty named volume, then verifies the restored event. This is local/container verification, not evidence of a live Hostinger deployment or actual-host recovery.

## Open-source partner checklist

[Hostinger's official open-source program](https://www.hostinger.com/open-source-partners) asks for a maintained public GitHub project, clear README and an open-source license permitting deployment. This project is public and MIT-licensed. Hostinger separately reviews one-click deployment readiness.

Before describing this project as one-click deployable or adding a working referral button:

- Verify an authorized Hostinger VPS install and recovery using synthetic data.
- Submit the repository through the [developer program](https://hpanel.hostinger.com/developer-program) and obtain its actual review outcome.
- Confirm how the private SSH-only UX and secret provisioning fit the program's template flow.
- Obtain a real partner code and use the exact approved deployment link from the dashboard. Do not invent a code or publish a placeholder button as functional.

Program participation, referral earnings and app-catalog listing are not guaranteed by this release. No application, purchase, account configuration or live deployment is included.

Additional sandbox lifecycle check: build the reviewed candidate with `docker build -t webhook-replay-lab:release-candidate .`, then run `node test/lifecycle-smoke.mjs`. It verifies fresh install, v0.2.1-source upgrade, rollback reading newer retained state, re-upgrade and stopped-backup recovery into a separate volume. Both versions use the current patched runtime. No host ports or external container network are used; this does not replace actual host acceptance.
