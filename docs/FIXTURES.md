# Portable fixtures and CI

A fixture is `{ "version": 1, "payload": {...}, "sha256": "..." }`. The digest is SHA-256 of `JSON.stringify(payload)`, not a signature or proof of trusted origin. Do not reorder payload keys after export without regenerating its digest.

## Collections

A version-1 collection has `kind: "webhook-fixture-collection"`, a simple `name`, and 1–20 unique named entries in `fixtures`. Each entry contains `name` and `fixture`. See `examples/orders.collection.json` for a harmless example. Names are metadata: do not put secrets in them. Collections have no timestamps or replay destinations, and are suitable for source control only after reviewing the data. Downloads use compact JSON so exported files stay within the CLI file limit.

Workbench's **Export filtered events (max 20)** saves the current filtered events as a collection. Narrow the inbox search if more than 20 events match. Event IDs become stable entry names. Missing/expired events or excessive total size reject the whole export; no silent truncation.

Paste the exported JSON in **Import fixtures** and validate/preview before importing. All entries are checked before any event is added. Total sanitized collection limit is 256 KB (257 KB request envelope); each payload remains at most 64 KB. If the inbox cannot fit all entries, nothing is imported. Fresh IDs, creation times and empty attempt lists are assigned. Import does not replay.

## Offline verification in CI

```sh
node bin/fixtures.mjs verify examples/orders.collection.json
```

Outputs one JSON line with `ok`, count, digest and whether additional redaction was needed; exit 0 on validated already-sanitized input, 1 on invalid input or when additional redaction is required. It never contacts a server. A valid hash is not a claim that free text is safe to share. The repository CI validates this example in addition to tests.

## Explicit staging replay

Start a private local server with an exact operator-confirmed HTTPS staging allowlist. Use a token file or protected environment variable; never place a token in command arguments, commit it, or print it in CI logs.

Use the reviewed candidate checkout in both terminals. Node does not load `.env` automatically. If an instance already owns port 4319, stop it deliberately or use its existing matching configuration; do not start another over it. Provision a private token file (mode 600, random token of at least 32 characters) outside the repository using your normal secret-storage process. Both processes must read the same file.

Terminal A, after replacing the example URL with your authorized staging endpoint:

```sh
LAB_TOKEN_FILE=/protected/path/token \
STAGING_ALLOWLIST=https://your-owned-staging.example/webhook npm start
```

Terminal B (this command actually sends one request):

```sh
LAB_TOKEN_FILE=/protected/path/token node bin/fixtures.mjs replay examples/orders.collection.json \
  --entry created \
  --server http://127.0.0.1:4319 \
  --target https://your-owned-staging.example/webhook \
  --confirm 'SEND TO STAGING'
```

This command sends one selected fixture only, never an entire collection. It requires a sanitized fixture, explicit target, explicit confirmation and a local server allowlist match. The server still applies SSRF/TLS/DNS policy and its one-time approval. It imports a local event, prepares it and sends once. It never enables ingress or relaxes the allowlist. CI runners must be trusted and their staging endpoints/downstream side effects separately authorized.

Machine output includes event/attempt IDs, delivery outcome and recorded HTTP status/latency, not the token or payload. Exit 0 means an HTTP 2xx response was received, not business processing success. Exit 1 means validation/setup failed before replay. Exit 2 means an unsuccessful or uncertain replay outcome. Network interruption after replay submission is reported as unknown. Inspect receiver logs before trying again; no automatic retries. Server rate limiting applies.

The CLI path is covered with synthetic loopback servers and injected transports. The shared server replay API has also passed a controlled external HTTPS receiver test (FINAL_CANDIDATE_ACCEPTANCE.md); that API test is not evidence that this CLI command was itself run externally. Do not use a production destination to demonstrate readiness.
