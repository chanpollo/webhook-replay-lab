# Alpha review disposition

A pre-release review found two functional/security issues in the initial implementation. This is not a formal security audit.

## Addressed

1. **UTF-8 corruption across request chunks.** The server previously decoded each chunk independently. It now bounds raw bytes, concatenates them, and performs one strict UTF-8 decode. A regression splits a Thai character across network chunks.
2. **Incomplete obvious-secret key coverage.** Redaction now recognizes CVV/CVC, PIN, OTP/TOTP, JWT, private keys, session IDs, financial account/routing numbers, IBAN and recovery/access/signing/encryption key variants. Tests cover snake_case, camelCase and uppercase variants without masking ordinary `shipping` or `opinion` fields. This remains pattern-based redaction, not comprehensive DLP.
3. **Missing oversized-request assertion.** A regression now verifies a request larger than 64 KB returns HTTP 413 and does not create an inbox event.

The requested CK reviewer confirmed the redaction blocker closed on `a24494a` after a source/test read-through. Tests run by the implementation task and GitHub CI remain separate evidence; no unperformed reviewer test run is claimed. The remaining non-blocking AWS access-key field regression has also been added.

## Second review

Agy / Gemini 4 Argon High reviewed the supplied public files at `11db045` and returned **Approve Alpha**, with zero release blockers. This was a source/configuration/documentation review, not an additional runtime test or formal security audit. It confirmed the CK fixes.

Non-blocking follow-ups are tracked in the plan: distinguish a server-rejected replay from an uncertain network outcome in the UI; use own-property checks for prototype-named JSON keys in comparisons; keep the intentional rejection of dual-stack DNS answers clearly documented.

## Publication conditions

- Verify passing CI on the final release commit, not only an earlier revision.
- Both requested reviews are complete. Keep their source-review scope separate from independently executed tests.
- Keep the local Docker startup limitation distinct from the successful GitHub container-runtime check.
- Do not imply that synthetic or injected-transport tests constitute a real provider/staging integration test.
