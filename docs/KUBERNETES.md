# Kubernetes self-hosting package

This repository includes executable Kubernetes resources, an immutable-image renderer, static/behavioral checks and a disposable kind acceptance harness. No real cluster was changed during implementation. Actual CI acceptance is a separate gate; do not infer it from static checks.

## Defaults and contract

- One replica, `Recreate` upgrades, one `ReadWriteOnce` PVC; never scale this single-file inbox horizontally.
- Private `ClusterIP` service only. No Ingress, NodePort, external IP or public admin endpoint.
- Both containers run UID/GID 1000, no privilege escalation, read-only root filesystem, all capabilities dropped, RuntimeDefault seccomp, explicit CPU/memory bounds and no service-account token.
- Startup/readiness/liveness probes send `Host: localhost`, matching the application's private Host policy.
- Empty staging allowlist; both generic and Stripe ingress disabled. Default-deny ingress and egress NetworkPolicy is included. Egress denies replay until an operator approves a suitable cluster policy. Application URL/DNS validation still applies after any network policy change.
- NetworkPolicy requires a supporting CNI. Default kind networking does not establish enforcement; neither static manifests nor a kind pass prove external network isolation.

## Private files and persistence

The PVC mount may be kubelet/root/group-owned. A non-root init container creates **its own** `/data/private` directory with mode 0700; the encrypted store is `/data/private/inbox.enc`. `fsGroup: 1000` permits initial directory creation; `OnRootMismatch` limits recursive ownership changes. The init fails closed if an existing private directory has the wrong owner/mode. It does not chmod or repair live data automatically. Validate behavior with your actual CSI driver; an incompatible volume needs an operator-reviewed migration.

The externally created Secret `hook-required-secrets` must contain `admin-token` and `storage-key`. There are no secret values in these manifests. The init reads only those fixed kubelet-projected files with bounded reads and validates them. It copies them into a memory-backed `emptyDir` as UID 1000 mode 0600 regular files. The application never mounts the original projected Secret volume. This avoids passing kubelet symlinks/root-owned files to strict secret-file loaders. An identical completed copy is accepted on init retry; a conflicting, partial or unsafe existing copy fails closed. Recreate the failed pod after correcting its input rather than weakening file checks.

Secrets are snapshots at pod creation, not hot-reloaded. Token rotation requires a controlled single-writer restart. **Do not change the storage key for existing data**: encrypted key migration is not implemented. Retain the matching key separately from an offline backup. PVC retention and backup availability remain operator responsibilities. Never delete the PVC as an upgrade step or remove a lock while a writer may be alive.

## Render and install on an authorized cluster

The checked-in image is an intentionally unusable placeholder, not a floating production default. Render with an already-reviewed immutable registry image:

```sh
node deploy/kubernetes/render.mjs --image registry.example/your-reviewed-hook@sha256:YOUR_VERIFIED_64_HEX_DIGEST > reviewed-kubernetes.json
```

The renderer rejects mutable tags and malformed/placeholder digests before any cluster operation. It does not run kubectl or access credentials. Do not apply the raw placeholder templates.

An operator must select an explicitly authorized kubeconfig/context, a StorageClass supporting the requested RWO PVC, namespace/RBAC permissions and an image pull mechanism. Create the namespace and required Secret securely from private files through that context, then review and apply the rendered objects. Never put production keys into command-line literal arguments, shell history or the repository. A private registry may require separately approved image-pull credentials. Kubernetes administrators can read Secrets; ensure encryption at rest/RBAC in the actual cluster.

After a successful rollout, access the service through `kubectl --context <approved-context> -n webhook-replay-lab port-forward --address 127.0.0.1 service/hook 4319:4319`, then open `http://127.0.0.1:4319` and unlock with the administrator token. Keep the forwarding process private. Test synthetic capture, restart and persistence before trusting a deployment. Actual backup/restore, monitoring, public provider ingress and customer traffic require their own acceptance.

## Validation

- `node --test test/kubernetes.test.js` validates manifests, private defaults, immutable-image rendering and real init behavior using temp-mapped files with randomly generated synthetic credentials.
- `node test/kubernetes-kind.mjs` requires installed Docker, kind and kubectl plus `KIND_NODE_IMAGE` pinned to an officially verified `kindest/node@sha256` digest. `LAB_TEST_IMAGE` selects the exact prebuilt/scanned CI image. It does not install tooling.
- The harness creates its own uniquely named kind cluster with an explicit isolated kubeconfig/context. It substitutes a unique local image tag with `imagePullPolicy: Never`, loads the exact selected image, creates random synthetic Secret values without logging them, validates private port-forward access/authentication, owner-only copied secrets, disabled ingress, PVC persistence over graceful Recreate rollout and the absence of public Services/Ingress.
- Cleanup deletes only that dedicated cluster, local candidate tag and temporary files. kind uses an ephemeral Docker bridge and a loopback Kubernetes API port; this is **not** a network-none test. No real cluster or user's current context is used. The harness does not delete store locks to make restarts pass.
- Official tooling references verified 2026-11-13: kind `v0.33.0` release and its pinned Kubernetes `v1.37.0` node image, with kubectl `v1.37.0`. CI should verify binary checksums and load the exact scanned application artifact before running this harness.

Until the actual CI job succeeds, mark Kubernetes runtime acceptance **unverified**. Even a kind pass does not claim compatibility with every CSI/CNI, a Hostinger-managed Kubernetes offering, public exposure safety or production availability.
