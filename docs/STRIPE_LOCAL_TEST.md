# Stripe CLI local acceptance path

Real sandbox deliveries can reach a loopback Hook server through Stripe CLI without registering a public webhook URL. Use the **CLI listener's signing secret**, which is separate from a Dashboard endpoint secret. This provides a provider-delivery test path; public TLS, edge abuse controls and admin-route isolation are separate acceptance gates. [Stripe local webhook guidance](https://docs.stripe.com/webhooks#local-listener).

## Prerequisites and current status

Use an explicitly designated disposable **sandbox account/session**. The CLI is external tooling, not a Hook runtime dependency. In this session no Stripe CLI executable was found on PATH or standard Homebrew/local paths, no default CLI config was found, and no connected Stripe tool was available. No account login, installation, API request or event creation was performed. This guide is not evidence of a completed real Stripe test.

Before running it, use the official CLI installation/login flow and verify the selected sandbox with its owner. Do not use a live account, `--live`, production credentials, or test automation connected to real downstream effects. `stripe trigger` creates API objects and can generate related events; use a dedicated sandbox rather than an arbitrary shared account. [Stripe trigger behavior](https://docs.stripe.com/cli/trigger).

## Controlled procedure

1. Choose an unused local port (4321 below). Provision a separate private Hook workspace, admin token and storage key using the [native persistent setup](SELF_HOSTING.md). Keep `CONTAINER_MODE` unset so the server stays loopback-bound. Leave `STAGING_ALLOWLIST` empty: this acceptance step captures only and never replays.
2. In a **private terminal**, start a snapshot-event listener for the designated sandbox:

   ```sh
   stripe listen --events payment_intent.succeeded \
     --forward-to http://127.0.0.1:4321/ingress/stripe
   ```

   This command prints its signing secret. Store that exact value through your private secret-provisioning process in an owned, mode-0600 regular file outside Git; do not paste it into a shell command, chat, screenshot or shared log. Do not use `--print-json` or disable certificate/signature checks. Listener setup and event filtering are documented in the [CLI reference](https://docs.stripe.com/cli/listen).
3. Start Hook with `PORT=4321`, `LAB_TOKEN_FILE`, `LAB_STORAGE_KEY_FILE`, `LAB_DATA_PATH` and **`LAB_STRIPE_SECRET_FILE` pointing to that listener-secret file**. Configure only file sources, unsetting their direct secret variables. Use the reviewed candidate and inspect `npm run doctor` without dumping configuration. No public proxy, tunnel or DNS change is required.
4. After the private health/inbox check succeeds, trigger one test fixture in another private terminal using the **same designated sandbox session**:

   ```sh
   stripe trigger payment_intent.succeeded
   ```

5. Require the CLI forwarding result to show acceptance and Hook to retain the expected sanitized `livemode:false` event. Record only selected nonsecret evidence: exact Hook commit/build, CLI version, event type, HTTP status, retained count and masking result. Review free text before exporting; never archive listener startup output or full provider payloads as evidence. Restart Hook with the same key, file paths and listener secret, then confirm retained state.
6. Stop the listener and Hook after the isolated session. Preserve or retire only this session's private workspace according to retention obligations. No permanent endpoint or provider configuration was created by this procedure.

Repeated `stripe trigger` calls create new test events and do **not** prove same-event retry deduplication. The repository separately tests identical event ID/raw bytes signed with a new timestamp/signature, stale old-signature rejection, changed-body conflict and encrypted restart. Stripe signs each delivery attempt anew; a signature/timestamp is not the deduplication identity. [Stripe retry/signature behavior](https://docs.stripe.com/webhooks#preventing-replay-attacks).

Deduplication remains bounded to the documented 11-minute receipt window. This tool does not guarantee suppression across Stripe's entire retry lifetime, exactly-once processing, or safe automatic replay. A successful local CLI delivery does not close public HTTPS/TLS/isolation or Hostinger acceptance.
