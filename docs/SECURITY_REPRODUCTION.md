# Reproduce release security checks

Run from the reviewed checkout with Docker, curl, Node and npm available. Use a trusted local Docker daemon; the scanner accesses its socket. No image upload, application secrets or external staging requests are needed. Scanner advisory downloads contact the vendor registry.

```sh
mkdir -p security-evidence
docker build -t webhook-replay-lab:release-candidate .
image_id=$(docker image inspect webhook-replay-lab:release-candidate --format '{{.Id}}')
printf '%s\n' "$image_id" > security-evidence/image-id.txt
docker image inspect "$image_id" > security-evidence/image-inspect.json
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock:ro \
  aquasec/trivy:0.76.2@sha256:8f6bb947dbc528902e11f2f5be52f7b519f6a39d5d148f41166f2040499768fb \
  image --image-src docker --scanners vuln --exit-code 1 --format json "$image_id" \
  > security-evidence/trivy.json
node_version=$(docker run --rm --network none "$image_id" node -p 'process.versions.node')
curl --fail --silent --show-error --max-time 30 \
  https://raw.githubusercontent.com/nodejs/security-wg/main/vuln/core/index.json \
  -o security-evidence/node-core-feed.json
SEMVER_MODULE="$(npm root -g)/npm/node_modules/semver" \
  node scripts/check-node-advisories.cjs "$node_version" security-evidence/node-core-feed.json \
  > security-evidence/node-core-result.json
```

The image gate fails on any reported vulnerability or scan failure. The core checker fails on unparsed or unresolved ranges. Its calculation is **matches vulnerable range AND does not match patched range**: the Node feed often lists whole major versions in `vulnerable`, so failing to subtract `patched` would falsely report repaired releases.

The matching raw feed is preserved as `NODE_CORE_FEED.json`; historical full Trivy reports are `IMAGE_SCAN_BEFORE_RAW.json` and `IMAGE_SCAN_AFTER_RAW.json`. The feed/result carry hashes. CI retains fresh raw evidence for 14 days, including failure output. Do not confuse earlier image evidence with a later build: rebuild and scan the immutable image ID you will actually release.

Known-advisory scans do not establish absence of vulnerabilities or complete coverage of every statically bundled library. Independent review and owned staging/host acceptance remain separate gates. No benchmark or production-ready claim follows from a clean scan alone.
