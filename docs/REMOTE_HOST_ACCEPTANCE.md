# Owned-host sandbox acceptance

Executed 2026-11-12 15:40:37–15:42:36 UTC on an authorized idle Linux server. Host identity/IP and account details are intentionally excluded from this public project document.

- Source commit: `1c23f2899bdf42bacf24de171b9370dbbfc3be78`.
- Source build: `cf692e61d917`, version 0.3.0.
- Host Docker: 29.2.1; Compose: 5.1.0; test runner Node: 25.7.0.
- Locally built image on this host: `sha256:e854161cb3d2b612885cb811386ae073dc1903d4c2b007f89df57f8c2a754d7c`. This platform-specific build is not the Mac image digest or a published registry artifact.

## Passed

1. Fresh temporary checkout matched the exact reviewed public commit and runtime build.
2. `node test/hostinger-smoke.mjs`: real Compose profile configuration, non-root hardening, disabled ingress, encrypted persistence across restart, vendor zlib fix and separate-volume stopped-backup restore.
3. `node test/lifecycle-smoke.mjs`: fresh install, stopped encrypted backup, upgrade from v0.2.1 application source, rollback reading candidate-created state, re-upgrade and recovery into a separate empty volume. Both application versions used the current patched runtime.
4. Original container inventory was identical before and after. Pre-existing stopped containers were not started, altered or removed.
5. No disposable test volumes remained. The candidate-only image and temporary checkout were removed. No running test containers remained; listeners still consisted only of the host's existing SSH service.

## Isolation and limits

Application test containers had `network none` and no published host ports. Test credentials and payloads were synthetic. Build/checkout used official image sources and the public project repository; no credentials were copied between hosts. No firewall, DNS, TLS, network or existing service settings changed.

This establishes **remote owned-host sandbox acceptance**, not a live Hostinger deployment, a public endpoint, an externally reachable HTTPS receiver or a successful external replay. Public DNS/TLS/ingress and client SSH-forwarding acceptance remain untested. The result does not assert market parity, production gateway readiness or human usability.
