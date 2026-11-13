# Exact-source CI and the 9a088a4 checkpoint

`9a088a4f65fee223dcd2fc1e05f9289309a58235` originally had **no CI/check runs**, because its commit message contained `[skip ci]`. The earlier successful run for `fae063f` is historical evidence for that different SHA; it does not prove that `9a088a4` ran CI.

Fresh checkpoint execution: [run 43395140386](https://github.com/chanpollo/webhook-replay-lab/actions/runs/43395140386). This workflow-dispatch run uses workflow definition `fe24b7a6f1740ea18ab6dcea807b62c287b0480a` and explicitly checks out source **`9a088a4f65fee223dcd2fc1e05f9289309a58235`** in every job. All six jobs completed successfully on 2026-11-13, including fresh 147-test Node matrices and a new 1,800-second workload. Six checkout guards, image metadata and benchmark metadata were verified to name `9a088a4`, not `fae063f`. The direct commit status `ci/exact-source-checkpoint` links to this fresh run. Its steady p95 was 2.882 ms, with zero 5xx, 51/150 burst requests returning 429, and all 20 expected records after reopen.

## Identity contract

- Normal push/PR CI tests its event SHA. A manual run may select a full lowercase 40-character immutable source SHA.
- Every job checks out that SHA, then requires `git rev-parse HEAD` to equal it before any tests/builds. Moving branch names are rejected by the guard.
- `build.json.commit` and its local image tag identify the **checked-out source**. `build.json.workflowCommit` identifies the workflow/event SHA. They can legitimately differ on a checkpoint rerun; neither is silently substituted for the other.
- The endurance process receives its actual checkout SHA, so `endurance.json.reference.sourceCommit` must match `build.json.commit` and the requested source.
- Node 22/24, browser, container/security/offline lifecycle, kind and the unchanged full 30-minute workload all execute again. No earlier image or measurement artifact is used as acceptance.

Example, from the branch containing the new dispatcher:

```sh
gh workflow run ci.yml --ref codex/r1-recovery-operations-20261113 \
  -f source_sha=9a088a4f65fee223dcd2fc1e05f9289309a58235
```

GitHub's run `headSha` is the workflow/event commit on a manual checkpoint run. For PR runs it is the branch tip while the executed/tested workflow may be the synthetic merge commit; the evidence collector keeps those identities separate and checks merge ancestry. Use the checkout guards, image metadata and endurance source identity together to establish the tested SHA. A successful run for another SHA or merely an unchanged application build hash is insufficient.

Future candidate/release changes should use ordinary CI without skip markers. Any historical checkpoint needing fresh verification can use this explicit route. Release approval, a public receiver and registry publication remain separate operations.

## Retained fresh evidence

The [CI summary](evidence/checkpoint-9a088a4/ci-summary.json), [six checkout guards](evidence/checkpoint-9a088a4/checkout-guards.txt), [image identity](evidence/checkpoint-9a088a4/build.json), [new full-duration measurements](evidence/checkpoint-9a088a4/endurance.json) and [GitHub ZIP/per-file provenance](evidence/checkpoint-9a088a4/artifact-provenance.json) come from run `43395140386`. The source is `9a088a4`; workflow definition is `fe24b7a`. Image ID is `sha256:dcf8c2d68d70325de13fe41aebd02c4f00fd42389a847f864e680c75d96eec8b`. A private local packet was prepared and all its checksums passed; `published` and `releaseApproved` remain false.
