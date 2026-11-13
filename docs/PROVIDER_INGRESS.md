# Stripe staging signature verifier

The private server now implements opt-in `POST /ingress/stripe` for Stripe test-mode events. No public endpoint, account configuration, deployment or outbound Stripe signature generation is included.

## Reviewed algorithm

Source: official [Stripe webhook signature guidance](https://docs.stripe.com/webhooks/signature) and [stripe-node Webhooks.ts](https://github.com/stripe/stripe-node/blob/master/src/Webhooks.ts), implementation read 2026-11-13.

Stripe signs `timestamp + "." + raw_request_body` with HMAC-SHA256. Use the complete `whsec_...` endpoint signing secret as the UTF-8 key, not an API key and not a hex/base64-decoded suffix. Preserve exactly the incoming bytes. A proxy or parser that changes whitespace, Unicode, newlines or JSON key order can invalidate the signature. Multiple `v1` signatures may be present; a matching one is sufficient. Other version signatures do not substitute for `v1`.

This implementation is intentionally stricter than the general Stripe SDK: exactly one canonical integer `t`, exactly one physical signature header, a fixed symmetric freshness window **strictly less than 300 seconds** (both ±300 boundaries rejected), bounded fields/signatures/body, and no option to disable freshness. These conservative limits must be checked against real test-mode deliveries before claiming production compatibility.

## API and configuration proposal

```js
const verify = createStripeVerifier({secret, now: Date.now});
const verified = verify({
  rawBody,          // Buffer captured before any decode, parse or redaction
  signatureHeader,  // one Stripe-Signature string
  headerCount      // mandatory integer 1, counted from actual raw HTTP headers
});
// verified is only {provider: 'stripe', timestamp}
```

Construct at startup. Startup configuration: `LAB_STRIPE_SECRET` or `LAB_STRIPE_SECRET_FILE`, never both. Prefer the file: owner-only mode, owned by the application user, regular and single-linked (no symlink/FIFO), maximum 4 KB, bounded strict UTF-8 reading. No default and no secret in a URL, client script, image, logs or response. Configuration and file errors never print values or paths. Encrypted persistence is required; the route stays disabled when no secret is configured. Existing private Compose profiles do not automatically forward or mount this opt-in configuration.

Use the signing secret for the exact Stripe **test/sandbox endpoint**. Stripe CLI forwarding and Dashboard endpoints use different signing secrets. Neither the prefix nor a valid signature proves test mode; the caller must enforce it after authentication.

## Implemented server integration order

1. Explicit opt-in staging route, persistent storage and independent rate/body/deadline limits. Enforce a maximum 64 KiB while receiving, not after unlimited buffering. Do not trust Content-Length alone.
2. Count case-insensitive `Stripe-Signature` occurrences in `req.rawHeaders`. Require exactly one physical header; Node's normalized headers may merge repeated lines. Do not hardcode `headerCount: 1` from the normalized string.
3. Verify the original `Buffer`. A normalized header array, duplicate `t`, malformed signature, stale/future timestamp, body mismatch or unsupported size fails closed. Return a generic failure; do not log the header, body or signing secret.
4. Decode UTF-8 strictly and parse JSON only after verification. Require the supported event schema, a bounded event ID, and **`livemode === false`**. Reject a validly signed live-mode event. Do not infer mode from user-controlled route names or token prefixes.
5. Apply configured redaction before storage. Persist receipt deduplication with the correct provider/event identity and retention semantics. Receipt acceptance is not exactly-once processing or business success. Handle failed persistence without acknowledging success.
6. Outbound replay remains the separate admin-confirmed staging workflow. Never forward original authentication headers or invent a Stripe signature for modified/redacted content. A provider-authenticated destination needs an explicit reviewed test adapter; this verifier alone does not make replay acceptable to Stripe-signature checks.

## Limits and evidence

- Buffer body: 1–65,536 bytes.
- Signature header: at most 4,096 characters and 16 comma-separated fields.
- At most 8 valid-length `v1` signatures; every supplied `v1` must be well formed.
- Unknown version fields may be ignored only when syntactically bounded hexadecimal values; unknown nonversion fields fail closed.
- Every candidate signature is compared using `timingSafeEqual` over 32-byte digests; no early return on the matching entry.
- Local tests use synthetic signatures only. No real Stripe account delivery or public-route acceptance is claimed.

Tests cover exact Thai UTF-8/raw-byte handling, multiple signatures, wrong secret semantics, duplicate headers/timestamps, strict freshness boundaries, malformed input, oversized requests, and no secret/body/header information in errors. The verifier intentionally does not parse events or authorize `livemode`; server integration tests cover those additional gates, duplicate physical headers, failure-to-persist, per-provider receipt conflicts and encrypted sanitized storage.

## Receipt and downgrade safety

Custom ingress keeps its original external event ID as the receipt key for backwards compatibility. Stripe uses a `stripe_`-prefixed SHA-256 of its event ID, plus a persisted provider marker. Receipt payload hashes bind exact raw bytes; same ID/different payload returns 409, not successful deduplication. A custom request that tries a Stripe receipt key is rejected even if its payload is identical. A Stripe receipt colliding with a legacy/custom key is also rejected for operator review. No existing event is overwritten.

Receipts expire after 11 minutes to outlive the entire strict timestamp acceptance window. Dedup is finite and not exactly-once delivery. Older application versions may discard new provider metadata: subsequent Stripe processing fails closed with a conflict rather than assuming equivalence. Disable Stripe ingress during downgrade; only upgraded versions implement this route. Generic receipt IDs remain readable and deduplicable by historical code, subject to that code's older checks.
