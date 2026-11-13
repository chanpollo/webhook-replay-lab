# Verify Docker archive identities before loading

The `imageId` in CI `build.json` is Docker's local `.Id`. With a containerd image store it can identify an OCI index or manifest. With a legacy Docker store it usually identifies the config. Do not label every Docker ID a config digest. A Docker-save gzip export can contain Docker-compatible `manifest.json` **and** OCI layout/index blobs; earlier documentation incorrectly excluded OCI layout content.

## Observed exact-source artifact

The retained private archive from [source `6a8959b`, run 43402539238](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43402539238) contains one archive root, a Linux amd64 runtime manifest and build attestation metadata. Its identities differ:

| Object | SHA-256 digest |
| --- | --- |
| Docker local ID / OCI index | `da932f1651d4f5d5a4f0d36350c564c3786f42e70575a06aa7b72a72d06d675f` |
| Selected Linux amd64 OCI manifest | `30042526647eb200d54f0b0c0b7145c661cef76cdcfcad93c116ae9a5bfb5503` |
| Runtime config | `b844a8d88d1a15a1aa3993e9bdc46b82b2fec6b7a4bb9b243ecfc2d3240accfa` |

Direct archive secret scanning reported the config identity, while daemon-based CI scanning reported the local index identity. The difference prompted direct graph verification; it is not evidence that another runtime was substituted. No registry push, signature verification or attestation authentication is established by these local bytes. A future published index may retain a digest, but its existence/access/provenance in an approved registry still needs verification.

## Offline verification

Use Node 22+ and the three files from the **same exact-source CI run**, with matching retained checksums/provenance:

```sh
node scripts/verify-image-archive.mjs \
  image/webhook-replay-lab-linux-amd64.tar.gz \
  image/build.json \
  security/image-inspect.json
```

This opens no listener, contacts no registry, uses no Docker socket and extracts no files. It streams a bounded regular gzip/tar, hashes each member, rejects linked/unexpected/duplicate paths and invalid headers/footer/padding, verifies all digest-addressed blobs and OCI descriptor sizes, and requires one matching archive root/runtime config/tag/platform. It rejects competing runtimes and misleading/missing indexed platform descriptors, checking every ancestor platform along the selected path. Only explicitly marked unknown-platform BuildKit attestation metadata tied to that runtime is additionally accepted; its signatures are not authenticated. It checks the selected layer list, inspected rootfs, uncompressed layer hashes against config `diff_ids` (raw or bounded gzip layers), and security-relevant runtime configuration. Legacy Docker exports instead require the config ID and raw layer/diffID hashes. Unsupported compression/variants fail closed for review.

`dockerImageIdKind` identifies `oci-index`, `oci-manifest` or `config`; `configDigest` always names the selected config bytes. The packet preparer passes its already-validated metadata snapshot through stdin and requires the verifier's observed archive hash and returned identity to match that same snapshot, preventing pathname replacement from mixing proof and evidence. It retains the proof in `evidence/archive-identity.json` and in the packet manifest before creating an output directory. The separate 1 GiB archive/tar/gzip-layer expansion limits, 512-member limit, 2 MiB JSON-member limit, bounded graph depth and child-process timeout are intentional. It does not prove secret absence, authenticate build attestations, unpack/run the image or establish public-host safety.

## SBOM and secret-scan sidecars

Trivy 0.76.2 supports converting its retained JSON report to CycloneDX without rescanning or a Docker daemon. Preserve the unmodified report and conversion output. For an unpublished image, review inferred registry/package locations rather than presenting a local tag or config digest as a published registry identity. Record any normalization and manually identified runtime separately; retain schema/provenance checks and mark incomplete inventory explicitly. Node's embedded-library inventory and the separate Node advisory gate remain distinct.

File secret scanning and image-config secret scanning are separate options in Trivy; use both against the verified archive with offline mode and private output. The follow-up CI enables both alongside the existing vulnerability gate, and packet preparation rejects retained secret findings. Raw scan/inspection output stays in private runner files until a standalone policy verifies no secret findings and the expected baked-environment shape. Unsafe output is withheld from uploaded evidence; only a fixed failure receipt is retained. That policy is loaded from the immutable workflow commit, so manual runs of older source do not silently omit the new safeguard. Earlier vulnerability-only CI is not retroactively a secret scan. Keep any potential matches private until reviewed. A zero finding count is scoped heuristic evidence, not an absence-of-secrets guarantee or a replacement for human source/data review.

## Review and verification scope

Separate fresh read-only automated reviews found three P2 issues before acceptance: missing decompressed layer/diffID verification, verifier metadata/pathname snapshot substitution, and ambiguous OCI platform/runtime selection. All were corrected, with regression coverage for recomputed malicious graphs, narrowed expansion bounds, same-image/different-archive bytes, competing runtimes and misleading platform metadata. The final review found no confirmed actionable defect, including the private CI retention helper. [Sanitized conclusions and reviewed code hashes](evidence/archive-identity-review/reviewed-files.json) are retained without account diagnostics.

The implementing agent separately passed 163/163 local tests with loopback-only synthetic listeners and verified the actual retained `6a8959b` archive's 21 members/10 layers, config/rootfs and distinct index/config IDs. Earlier restricted-sandbox attempts could not open local sockets; the permitted loopback rerun passed. This does not substitute the new source revision's CI, actual Hostinger/Stripe delivery, human threat review or registry/release approval. Runtime build remains `e764835f4f8d`; these tools are outside shipped runtime inputs.

References: [OCI config/diffIDs](https://github.com/opencontainers/image-spec/blob/main/config.md), [OCI index/platform selection](https://github.com/opencontainers/image-spec/blob/main/image-index.md), [Trivy report conversion](https://trivy.dev/docs/v0.76/guide/configuration/reporting/#converting), [container metadata/secret scanning](https://trivy.dev/docs/v0.76/guide/target/container_image/#container-image-metadata), [CycloneDX 1.7 schema](https://cyclonedx.org/schema/bom-1.7.schema.json).
