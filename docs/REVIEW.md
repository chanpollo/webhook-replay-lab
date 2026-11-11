# Alpha review disposition

A pre-release review found two functional/security issues in the initial implementation. This is not a formal security audit.

## Addressed

1. **UTF-8 corruption across request chunks.** The server previously decoded each chunk independently. It now bounds raw bytes, concatenates them, and performs one strict UTF-8 decode. A regression splits a Thai character across network chunks.
2. **Incomplete obvious-secret key coverage.** Redaction now recognizes CVV/CVC, PIN, OTP/TOTP, JWT, private keys, session IDs, financial account/routing numbers, IBAN and recovery/access/signing/encryption key variants. Tests cover snake_case, camelCase and uppercase variants without masking ordinary `shipping` or `opinion` fields. This remains pattern-based redaction, not comprehensive DLP.
3. **Missing oversized-request assertion.** A regression now verifies a request larger than 64 KB returns HTTP 413 and does not create an inbox event.

## Release checks still required

- Verify passing CI on the final release commit, not only an earlier revision.
- Complete or explicitly defer the second requested review; do not claim it occurred without evidence.
- Keep the local Docker startup limitation distinct from the successful GitHub container-runtime check.
- Do not imply that synthetic or injected-transport tests constitute a real provider/staging integration test.
