# Isolated reverse-proxy acceptance

`npm run test:proxy` builds the candidate image unless `LAB_TEST_IMAGE` names an already-built candidate. It pulls the official **amd64** image `caddy:2.11.9-alpine@sha256:fc9cbc100585871d18d4e451cca7021785c90a7006087427ae5ceb3e4efe6424`. The lab uses `network none`; Caddy shares only that namespace. Neither container publishes a host port. A temporary named volume contains only synthetic encrypted test state. Cleanup removes only the generated containers, volume and local config.

The test reads the actual `deploy/Caddyfile.example`, replacing its single example hostname with `:8080` and adding `auto_https off`/`admin off` inside the global block. Its matchers, raw URI checks, request size limit, Host rewrite, authorization stripping and timeouts are otherwise unchanged. This proves route behavior over isolated HTTP, **not external DNS/TLS, certificate renewal, public firewall configuration or Hostinger deployment**.

The recipe requires exact raw URI (`/ingress` or `/ingress/stripe`) and POST, bounds request body size and read deadlines, and limits proxy-to-app connections to eight with bounded upstream dial/read/write/header deadlines. This helps constrain one proxy's upstream socket use; it is not network-level DDoS protection or a global bound across multiple proxies.

Both ingress routes remain disabled unless their separate signing secret and persistent storage are configured. Routing does not enable either provider automatically; Stripe is test-mode-only.

Checks: valid raw HMAC capture, valid Stripe test-mode capture/duplicate/forged signature/live-mode denial, duplicate capture acknowledgment, private admin/assets/health routes denied even with valid admin/forwarding headers, wrong methods, query/trailing/encoded/dot-segment URI variations, invalid signature and cross-origin rejection, oversized chunked body rejection, and final retained state containing only the two accepted redacted synthetic events.

## Evidence status

Harness syntax and source review completed locally. Local Docker daemon was not running and was **not started**. Actual Caddy adaptation and container execution must pass the new CI `Check isolated ingress reverse proxy` gate before these checks are claimed as executed. A failed gate is a release blocker; do not remove a negative test merely to make it pass.

Public exposure remains a separate authorized operation with an owned hostname, trusted TLS, monitored resource limits and tested recovery. Keep the admin listener private even after this gate passes.
