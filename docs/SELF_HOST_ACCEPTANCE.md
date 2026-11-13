# Self-host candidate acceptance — 2026-11-13

Exact source: `083ceed3c978eac0eaa4a0721fe803fb26364a26`. Runtime build: `58f35f208f9b`, package `0.3.0` unreleased.

[All CI jobs passed](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43350428884). This is engineering acceptance, not a v1 release, registry publication, actual Hostinger deployment or production certification.

## Executed checks

- 129 tests passed locally and on Node 22/24 CI; syntax, manifest behavior, private secret-file and ingress regressions passed.
- Hardened container, encrypted restart, private Hostinger-compatible Compose profile, image-profile configuration and real isolated Caddy route-isolation tests passed.
- The immutable final Linux amd64 image was scanned, saved as a Docker archive, loaded back, and its image ID checked. Raw Trivy evidence contains zero vulnerability findings; Node 24.22.3 advisory comparison covered 47 matched ranges with patched ranges and no unresolved/unparsed entries. Findings are database/time scoped, not a guarantee against unknown vulnerabilities.
- A separate CI job downloaded the archive, checked its SHA-256 and image ID, then loaded that exact image into a disposable kind Kubernetes 1.37.0 cluster.
- Actual Kubernetes checks passed: UID 1000, private regular owned secret copies, private encrypted-store directory, capture/redaction, graceful Recreate restart retaining the encrypted PVC record, private ClusterIP, ingress disabled, private port-forward and authentication.
- The harness removed its own temporary cluster, image tag and files. No existing cluster or Mac Docker daemon was used.

## Image artifact

Image ID: `sha256:667231c40c79698c19e05183795b41fcc6f6e87cb4fc2254434fd63437e2f4e3`.

Artifact: `verified-image-linux-amd64`, ID `14003148484`, 62,370,855 bytes, retained for 14 days from 2026-11-13. Download it from the linked CI run. It contains `webhook-replay-lab-linux-amd64.tar.gz`, `SHA256SUMS` and `build.json`. The archive is **docker-save + gzip**, not an OCI-layout tar or a published registry digest. See [load and verify](CONTAINER_IMAGE.md). No ARM64 image is claimed.

## Scope and remaining gates

Default kind networking does not establish NetworkPolicy enforcement. Test the actual target CNI, CSI, RBAC, backup/restore, capacity and operating procedures before relying on a customer cluster. This run used an ephemeral CI Docker bridge and a loopback API/port-forward; it was not network-none or a public deployment.

Stripe signatures were tested with synthetic valid/invalid messages and through the isolated proxy, not a real Stripe account delivery. The public TLS/receiver acceptance recorded for earlier runtime `98aadcff4fdf` is historical evidence and does not automatically certify this newer runtime. Actual Hostinger installation/program acceptance, human usability, external provider acceptance and formal release publication remain separate gates.
