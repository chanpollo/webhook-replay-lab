# Prepare an unreleased engineering packet

This creates a **private local artifact**, never a registry push, GitHub release, deployment, account login or public listener. Successful preparation means the supplied trusted CI evidence is internally consistent. It is **not release approval** or cryptographic proof of publisher authenticity. Obtain artifacts from the reviewed repository's exact successful run, then complete the remaining human/provider/host/publication gates.

## Inputs

Use an owned, private workspace and Node 22+, GitHub CLI (`gh`), Git and `unzip` on PATH. Run the collector against the reviewed repository's successful exact-source run:

```sh
mkdir -m 700 release-artifacts
node scripts/collect-ci-evidence.mjs RUN_ID release-artifacts/evidence-RUN_ID
```

The collector authenticates through the normal GitHub CLI credential store with an explicit `github.com` host, checks the repository/workflow/run, downloads the three named artifacts, verifies each ZIP against GitHub's SHA-256 digest, and extracts only bounded allowlisted members into private regular files. For PR runs it retains the API branch-tip identity separately and verifies the tested synthetic merge ancestry through GitHub. It records run IDs, workflow identity, ZIP digests and per-file hashes in `artifact-provenance.json`; `ci-summary.json` comes from that same run. A mix of another run's green summary and these files is rejected. Metadata is a trusted-download consistency record, not a signature or independent publisher authentication.

The resulting layout is:

```text
evidence-RUN_ID/
  image/       archive, SHA256SUMS, build.json
  security/    image-id.txt, image-inspect.json, trivy.json,
               node-core-result.json, node-core-feed.json
  endurance/   endurance.json
  ci-summary.json
  artifact-provenance.json
```

Do not manually combine these folders from different runs. The collector requires a completed successful run and never overwrites an existing destination. It makes authenticated read/download requests to GitHub only; it creates no release, deployment, registry image or listener. Keep tokens in the credential store and out of commands/logs. Select the actual [exact tested source](EXACT_SOURCE_CI.md), not the workflow SHA by assumption.

From the current reviewed tooling checkout, with that source commit locally available:

```sh
node scripts/prepare-release-packet.mjs \
  /private/workspace/evidence \
  release-artifacts/hook-COMMIT12-linux-amd64 \
  FULL_TESTED_SOURCE_SHA
```

Replace placeholders with the reviewed source SHA and paths. The output parent must be owned by the current user and not writable by others; the destination must not exist. `release-artifacts/` is ignored by Git so image archives are not accidentally committed.

## Fail-closed checks

The tool requires exact source/benchmark identity, a separate matching workflow identity, successful Node 22/24/container/kind/browser/endurance jobs, Linux amd64 image metadata, matching image inspection/Trivy identity and same-run artifact/file hashes, no known image findings or unresolved/unparsed Node advisories, the retained advisory-feed hash (zero matching vulnerable ranges is valid when unresolved/unparsed are empty), a complete 1,800-second workload with the original 250 ms budget, 95–105% of the nominal one-request/second steady coverage (timer tolerance), the exact capture/read/delete/auth-rejection mix, original limits, 150-request burst, consistent resource samples and bounded memory/disk/status results, and the actual image archive SHA-256. An earlier commit is rejected even when its runtime build hash matches. Unexpected baked environment-variable names require manual review rather than being packaged silently.

The packet contains the verified image, raw evidence, the exact executed workflow definition, a source archive of the exact Git commit, operator README, `packet.json` and SHA-256 checksums. Files are private and `packet.json` always says `published:false` and `releaseApproved:false`. Existing outputs are never replaced; failed copying can leave a private partial destination for inspection. Originals are not deleted. The tool does not detect arbitrary secrets or replace source/data review, image authenticity checks or a reviewed installation dry run.

## Review and execution evidence

[Separate automated reviews](INDEPENDENT_REVIEW_9A.md) found four P2 tooling defects, fixed before acceptance. The final re-review found no remaining actionable issue. Local tests passed 152/152 on Node 22/24; an actual `9a088a4` packet was collected, prepared and checksum-verified privately. This does not replace the final candidate CI or external gates.

## Gates before publication

- Resolve any review findings and pass CI on the exact final candidate/tag; retain complete evidence.
- Designate and verify the Stripe sandbox/CLI listener session; keep public TLS/isolation and exact-runtime staging replay separate.
- Complete human first-use tasks/interviews, independent human threat review and operator/notification ownership.
- Verify the authorized Hostinger/CSI/network/storage environment and real install/recovery path.
- Approve the permanent registry/repository, visibility, version tags and formal release. Record the published registry **manifest digest**, provenance and scan evidence; an image config ID or Docker-save checksum is not that digest.

No version bump or Release 1 success is implied by preparing the packet. CI artifacts expire after 14 days; retaining a private packet preserves bytes while approved permanent distribution remains unresolved.
