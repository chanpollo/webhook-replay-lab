# IPv6 replay destination policy

Candidate change, externally requalified with a dual-stack hostname; not yet released.

The ordinary global-unicast subset is `2000::/3` minus `2001::/23`, `2001:db8::/32`, `2002::/16`, `2620:4f:8000::/48`, and `3fff::/20`. This intentionally excludes special-purpose assignments even when some are globally reachable. Addresses outside this subset, IPv4-embedded textual forms, scopes/zone IDs and malformed addresses are rejected. This is not a guarantee that every globally routed destination is safe; an exact operator-owned staging URL remains mandatory.

Source reviewed 2026-11-12: https://www.iana.org/assignments/iana-ipv6-special-registry/iana-ipv6-special-registry-1.csv . Review new IANA assignments before expanding support; maintain this snapshot as reserved ranges change.

Every DNS answer must pass. A public A record never overrides an unsafe AAAA. The resolver family, if supplied, must agree with the address's parsed family. After validation, prefer IPv4 if present; otherwise select the first validated IPv6. Transport pins that exact address/family, retains the original hostname for certificate validation/SNI, disables connection reuse, and does not re-resolve, follow redirects or retry/fallback. IPv6 literals in URLs remain prohibited.

Tests cover negative ranges, compressed/expanded forms, CIDR boundaries, mixed answers, resolver-family mismatch, pinned lookup callback variants, and real loopback IPv6 TLS/certificate/correlation behavior. Test-only loopback injection does not change production DNS validation.

The earlier controlled Quick Tunnel test on the previous candidate verified trusted TLS but was correctly blocked by the old IPv4-only policy. Zero replay POSTs reached the receiver. The tunnel was stopped and returned HTTP 530 afterward. The revised policy subsequently passed a controlled external replay with matching receiver hash and correlation. See `EXTERNAL_HTTPS_ACCEPTANCE.md` for exact evidence and limitations.
