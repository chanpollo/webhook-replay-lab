# Install Hook

Choose the route that matches your machine. Hook has no runtime npm dependencies, so **`npm install` is not required**. Keep the admin interface on your own computer or behind SSH forwarding, never on a public website.

## 1. Choose a version

- **Stable:** `v0.2.1`, the latest published release identified by this project. Its features differ from the candidate.
- **Candidate:** `main`, currently unreleased `0.3.0`. Includes the newer redaction preview, scoped credentials, fixtures CLI and doctor. Check the exact checkout's CI before using it; main is not a stable release.

Use Git from its official distribution and a supported Node.js release from [nodejs.org](https://nodejs.org/). Node **24 LTS is recommended**; CI tests Node 22 and 24. The application requires Node 22 or newer. Docker is optional for local use.

## Compatibility and evidence

“Documented” is not the same as “tested.” No native installer, Homebrew formula, npm registry package, Windows installer or one-click Hostinger template is currently claimed.

| Route | Current evidence | Persistence |
| --- | --- | --- |
| macOS, native Node | Agent-operated fresh-checkout walkthrough passed, including fixtures and encrypted restart; not human usability evidence | Tested with a private directory owned by the current user |
| Linux, Docker Engine + Compose | Node/container CI and isolated owned-Linux-host install/restart/upgrade/rollback/restore passed | Tested named-volume profile |
| Linux, native Node | Node/API tests and controlled sender/runtime checks executed on Linux; the full native install walkthrough has not separately been recorded | Documented POSIX setup below; verify on the selected host |
| macOS, Docker Desktop | Earlier candidate container tests passed; latest runtime's container acceptance is from Linux CI/owned host, not a fresh macOS Docker test | Use Linux container volume; verify your selected version locally |
| Windows, native Node / PowerShell | **Not tested.** Memory-only instructions below are a trial path, not a supported-platform assurance | Native encrypted storage has POSIX permission/ownership checks; **do not assume Windows persistence is supported** |
| Windows, Docker Desktop with WSL2/Linux containers | **Not tested.** A possible Linux-container route, not Windows acceptance evidence | Verify mounts, secret permissions, loopback isolation and recovery before relying on it |
| Hostinger VPS | Docker profile is compatible in design and has passed owned-host sandbox tests; **no actual Hostinger install or program approval** | Requires an authorized VPS and host-specific acceptance |
| PHP/shared hosting, generic static hosting | Not a supported runtime for this Node/Docker service | Not applicable |

## 2A. Fast local trial: macOS or Linux

In a terminal, select a new folder so you do not overwrite another checkout:

```sh
git clone https://github.com/chanpollo/webhook-replay-lab.git
cd webhook-replay-lab
git checkout v0.2.1
node --version
npm start
```

For candidate features, use `git checkout main` instead of the stable tag and check that revision's CI.

Open **http://127.0.0.1:4319**. Paste the session token printed in your private terminal, select Workbench and capture the labeled synthetic sample. Never send the token in a URL, screenshot or chat. Keep the terminal open. **Ctrl-C stops the process; memory-only records disappear.** Export fixtures you want to keep.

If port 4319 is occupied, do not stop an unrelated program. In a new instance use an unused port:

```sh
PORT=4320 npm start
```

Then open http://127.0.0.1:4320. Do not set `CONTAINER_MODE=1` for native use: that option binds all interfaces and is intended only for a separately isolated container.

## 2B. Windows PowerShell trial: not yet tested

Install Node.js and Git from their official sources, then open PowerShell:

```powershell
git clone https://github.com/chanpollo/webhook-replay-lab.git
Set-Location webhook-replay-lab
git checkout v0.2.1
node --version
npm.cmd start
```

Use `git checkout main` for candidate features, subject to exact-candidate CI. `npm.cmd` avoids depending on execution of the PowerShell `npm.ps1` wrapper; **do not weaken PowerShell execution policy** to run the app.

Open http://127.0.0.1:4319 and use the private terminal token. To use a different unused port for this terminal session:

```powershell
$env:PORT = '4320'
npm.cmd start
```

Ctrl-C stops the trial. These instructions do not establish Windows support. Keep it memory-only until native filesystem compatibility is tested, or evaluate the Linux-container route separately. Do not bypass storage permission errors or change firewall/security settings merely to make a trial start.

## 3. Keep records between restarts: native macOS/Linux

Use the candidate's [native persistence instructions](SELF_HOSTING.md#native-node-persistence-without-docker). The essential setup is:

1. Create a **dedicated private directory owned by your current OS user**, not group/world writable. Do not reuse a live workspace or overwrite an existing key.
2. Provision an independently random admin token and a separate 32-byte hexadecimal encryption key in private files. Keep the encryption key backed up separately from the encrypted data.
3. Set `LAB_TOKEN_FILE`, `LAB_STORAGE_KEY_FILE` and `LAB_DATA_PATH` in the **same terminal** used to start the app. Native Node does **not** load `.env` automatically.
4. On the candidate, run `npm run doctor`, then `npm start`. A configured token is not printed; use the value from your own protected token file.
5. Capture synthetic data, stop gracefully, restart with the same configuration and verify the record survives.

Doctor checks configuration shape, not host security or successful recovery. Read its warnings. **Never replace the encryption key for existing data to fix an error**; that prevents decryption. Never delete a live lock file or run two writers against the same store.

Optional candidate settings:
- [Redaction rules](REDACTION.md): `LAB_REDACTION_PATHS_FILE`, additive masking and preview. Stricter rules can require a deliberate migration of old records.
- [Capture/read credentials](SCOPED_CREDENTIALS.md): `LAB_SCOPED_TOKENS_FILE`, private file, restart-based rotation. These roles share one inbox and are not tenant isolation.

## 4. Docker Compose on a Linux host

Use the [VPS Compose guide](HOSTINGER.md), including on an authorized non-Hostinger Linux server. It requires **Docker Engine 28+** and **Docker Compose 2.24.4+**. Check the server engine version, not only the CLI. Older engines may not provide the expected localhost publishing isolation.

The guide covers private secret provisioning, the `compose.hostinger.yaml` profile, named-volume initialization and SSH forwarding. This file's name is a compatibility profile, not evidence of Hostinger approval.

- Publish admin only to host loopback and access through SSH forwarding when remote.
- Keep signed ingress disabled and the staging allowlist empty for the first synthetic installation check.
- Use the same project name and volume across restarts/upgrades.
- Optional redaction/scoped-credential files need explicit read-only mounts and environment settings; existing Compose profiles do not automatically load them.
- Docker Desktop on macOS/Windows also requires its Linux engine to be running. Do not assume Windows mounts/permissions behave like POSIX; validate that route before storing important data.

Do not install Docker, open firewall ports, buy hosting or replace an existing website as an automatic part of this guide.

## 5. First-run checklist

- [ ] The version/build shown matches the checkout you intended to run.
- [ ] A valid token unlocks the inbox and an invalid token does not.
- [ ] The synthetic sample is masked as expected; candidate custom rules can be checked with Preview redaction before capture.
- [ ] Exported fixtures verify through the candidate CLI: `node bin/fixtures.mjs verify path/to/export.json`.
- [ ] No replay destination is enabled accidentally; replay requires a separately authorized harmless staging endpoint and explicit confirmation.
- [ ] If persistence is enabled, a graceful restart preserves the synthetic record, and a separate sandbox restore has been tested.
- [ ] Remote admin access uses the intended SSH forwarding path, not public access to port 4319.

This is installation acceptance, not proof of production scale or provider compatibility.

## If something fails

| Symptom | Next safe action |
| --- | --- |
| `EADDRINUSE` / address already in use | Choose another unused local port or identify your own existing instance; do not kill unrelated processes |
| Token rejected | Confirm both client and server use the same current token; editing a token file does not change a running process |
| `Storage is locked` | Confirm no writer is running before following the recovery guide; never remove a live lock |
| Wrong key / damaged snapshot | Stop and preserve the files; restore the matching key and backup in a separate workspace |
| Stored payload conflicts with redaction policy | Follow the explicit sanitized migration procedure; do not delete the old store to hide the error |
| Docker daemon unavailable | Check your chosen engine is running; native Node memory mode is a separate option, not an equivalent persistence setup |
| HTTPS destination blocked | Check exact allowlist, public-address policy and certificate; never bypass guards to reach production/private metadata services |

For backups, supported rollback boundaries, interrupted replay and retention, use [self-hosting and recovery](SELF_HOSTING.md). For verified versions and remaining product gates, use [candidate acceptance](FINAL_CANDIDATE_ACCEPTANCE.md) and [roadmap](ROADMAP.md).
