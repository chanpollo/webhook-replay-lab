# OCI image delivery strategy

Status: the latest follow-up Linux amd64 artifact, lifecycle/security and disposable Kubernetes acceptance passed for source `fae063f`; see [exact engineering evidence](R1_ENGINEERING_ACCEPTANCE.md). The prior `083ceed` record remains [historical evidence](SELF_HOST_ACCEPTANCE.md). This is not a registry publication announcement. Public registry publication remains subject to the release approval boundary.

## One artifact, several install targets

Build a minimal application image from the reviewed Dockerfile. Docker/Compose, Kubernetes and compatible Hostinger VPS profiles should reference that image rather than rebuild different runtime variants. Installation-specific data, domains, allowlists and secrets remain outside the image.

Current Dockerfile strengths: digest-pinned Node 24 Alpine base, explicit patched zlib, no runtime npm dependencies, non-root node user, application-only COPY and an HTTP healthcheck. Compose adds read-only root, dropped capabilities, no-new-privileges, resource limits and loopback publication. The persistent pilot profile provides a data mount. These controls are deployment settings, not all properties enforced by the image itself.

## Candidate CI download (not a registry release)

The current workflow is configured to export the **same image ID after the existing final-image security gate**, as artifact `verified-image-linux-amd64` retained for 14 days. Latest successful run: [`43389359288`](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43389359288), source `fae063f`, runtime `e764835f4f8d`; later runtime changes require their own successful workflow. The local tag is `webhook-replay-lab:VERSION-COMMIT12-amd64`.

The artifact contains `webhook-replay-lab-linux-amd64.tar.gz`, `SHA256SUMS` and `build.json` (version/build, full commit, Docker-reported local image ID, tag, platform, `archiveFormat: docker-save+gzip`, `publishedRegistry: false`). Modern Docker exports can include both Docker-compatible `manifest.json` and OCI layout/index blobs. The local ID can identify an OCI index or manifest rather than the image config. [Verify the archive graph and separate these identities](IMAGE_ARCHIVE_IDENTITY.md) before loading. This is not a publication or formal release. No arm64 support is asserted. A checksum downloaded with the artifact establishes consistency, not independent publisher authenticity; obtain it from the trusted repository's exact CI run and inspect the run's provenance.

After downloading and extracting that trusted run's artifact into a new directory:

```sh
# Linux: verify archive bytes before loading.
sha256sum -c SHA256SUMS
# macOS alternative: shasum -a 256 -c SHA256SUMS
docker image load --input webhook-replay-lab-linux-amd64.tar.gz
# Replace TAG_FROM_BUILD_JSON with the literal tag recorded in build.json.
docker image inspect TAG_FROM_BUILD_JSON --format '{{.Id}} {{.Os}}/{{.Architecture}}'
```

Compare the image ID exactly with `build.json.imageId`, and platform with `linux/amd64`. Stop on any mismatch; do not run the image. Loading imports a local image only and starts no container. Keep the archive, checksum, build record and corresponding security artifacts together if needed beyond CI retention. The existing Compose defaults build from source: merely loading an image does **not** make those defaults use it. Use the standalone `compose.image.yaml` profile described below for artifact-based deployment; it has no build step and never pulls implicitly. GHCR/public registry publication remains pending the release boundary.

## Artifact identity

For a future approved registry repository, publish an explicit semantic-version tag and a source-revision tag, and record the immutable manifest digest. Deployment references should take the form `REGISTRY/OWNER/IMAGE:VERSION@sha256:DIGEST` with actual validated values. These are placeholders, not an existing pull location. Never depend on `latest` alone. Keep the last known-good digest for rollback.

Attach OCI metadata for source URL, revision, version and license. Record the application's version/build beside the image identity. A local Docker image ID is not necessarily the registry manifest digest: record both as applicable and verify the pulled registry artifact before promotion. If a multi-platform index is published, retain its index digest plus platform digests and evidence for each supported architecture. Do not claim arm64 support merely because the base image offers it.

## Build, verify, promote

1. Select the exact reviewed source revision. Exclude credentials, customer payloads, local data, screenshots with secrets and private evidence from build context/artifacts. No credentials in build args, layers, labels, logs or default examples.
2. Build locally/CI without publishing. Run syntax/unit/API, fixture, container lifecycle/persistence and deployment-profile tests against that exact image. Existing Compose source builds remain valid until a registry route is actually released.
3. Scan the final immutable image, retain raw OS/package findings and Node advisory evidence, and resolve or explicitly review findings. Scan timing, database/tool version and artifact identity belong with results. SBOM/provenance generation is a delivery requirement, not claimed completed by this document.
4. Test selected host/architecture. Validate private admin binding, optional receiver isolation, protected mounted secrets, writable data only, resource bounds, graceful stop and backup/restore. Kubernetes needs separate disposable-cluster acceptance.
5. Only after publication authorization and release gates pass, publish approved tags/digests and metadata. Pull and verify the published digest, retain scan/provenance evidence and update install examples with the real repository and version. Do not claim publication from a successful local build or CI scan.
6. Promote the same tested digest to approved installations; never silently rebuild beneath an immutable release claim. Patch releases get new identity and rerun verification.

## Runtime contract

- Node process runs as UID 1000. Storage/secret ownership and permissions must satisfy the actual loader. Mounted Secret files in Kubernetes need explicit verification; root-owned default mounts may not be acceptable.
- One process / one encrypted store. No horizontal scaling, automatic failover writer or network filesystem support is claimed. Use a no-overlap replacement policy.
- Writable persistent data belongs on the dedicated data volume; keys are provisioned separately and not baked into images. Read-only root and capability/security settings must be preserved by each orchestrator.
- Container healthcheck uses port 4319. Any configurable port/probe changes need aligned image and orchestration checks; an image HEALTHCHECK alone does not configure Kubernetes probes.
- The receiver and administration share an application listener. Public exposure requires a reviewed restrictive edge that admits only the exact intended receiver routes, not the entire listener. Kubernetes ClusterIP alone does not restrict other pods.
- Abrupt crashes may leave a store lock. Recovery requires proving there is no writer; do not add a blind lock-delete init container or restart loop.

## Remaining delivery gaps to verify

Registry repository/visibility and publication approval; actual immutable registry artifact; tested architecture list; SBOM/provenance attachment; disposable Kubernetes cluster acceptance; actual Hostinger install/template acceptance. Engineering can prepare these paths without claiming they are already released or buying hosting.

Related: [installation](INSTALL.md), [self-host architecture](SELF_HOSTING.md), [roadmap](ROADMAP.md), [release readiness](RELEASE_READINESS.md).

## Run the verified local image with Compose

`compose.image.yaml` mirrors the hardened persistent `compose.hostinger.yaml` profile, replacing source build with required `LAB_IMAGE` and `pull_policy: never`. It exposes only loopback port 4319, disables ingress, and retains service `lab` and named volume `lab-data`. Static configuration tests are not host acceptance.

After the checksum, loaded image ID and platform checks above, provision independent random `LAB_TOKEN` and `LAB_STORAGE_KEY` through a private mode-600 `.env` as described in [SELF_HOSTING.md](SELF_HOSTING.md). Do not copy sample/test keys. Select a unique project name for a fresh install. For an existing installation **reuse its actual Compose project name** and confirm its volume identity before proceeding; a different project name creates a different inbox.

```sh
export LAB_IMAGE='EXACT_VERIFIED_LOCAL_TAG_FROM_BUILD_JSON'
# Example for a NEW installation; use the existing project's real name for an upgrade.
export HOOK_PROJECT='hook-workbench'
docker compose -p "$HOOK_PROJECT" -f compose.image.yaml config --quiet
docker compose -p "$HOOK_PROJECT" -f compose.image.yaml up -d --no-build --pull never
docker compose -p "$HOOK_PROJECT" -f compose.image.yaml ps
```

Replace the example tag before running. Never share expanded Compose config: it contains environment secrets. Missing images fail rather than pulling an unreviewed replacement. Open localhost:4319 (or use SSH forwarding for a remote host), perform synthetic capture and graceful restart, and verify retained data. This profile is private administration, not a public receiver deployment.

Before changing an existing source-built installation: inspect its Compose project/volume, stop its writer with the **original** profile and project name, make the offline data backup with separately retained key, then start this profile with the same project name and secrets. Do not use `down -v`, delete the volume, or run two writers. Rollback similarly stops the current writer and restores the compatible prior image/data/key set. Use the same `-p` and `-f` values for later stop/start/log operations.
