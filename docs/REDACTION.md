# Configurable redaction

Default key/text redaction always runs and cannot be disabled by custom rules. Set `LAB_REDACTION_PATHS_FILE` to an operator-controlled JSON array, for example:

```json
["$.customer.name", "$.items[*].description", "$.records[0].memo"]
```

The restricted JSONPath grammar supports dot fields, array indexes and array wildcards only. No expressions, recursive descent, arbitrary JavaScript, quoted-property selectors or full JSONPath compatibility. Up to 32 rules, 256 characters per rule, 32 components. Nonmatching paths are ignored. Array metadata such as `length` is not traversed as a JSON field. Own JSON properties including prototype-named fields are handled without prototype lookup.

Rules are loaded at process startup. Preview redaction in Workbench before capture; this returns only sanitized JSON and stores/sends no event. Editing payload, navigating or changing token clears the preview. Capture, signed ingress and fixture/collection import use the same policy. Import confirmation must match the newly sanitized hash.

Changing policy is not a silent migration. If retained payloads conflict with a stricter policy, startup fails closed and releases its own storage lock. Preserve the old encrypted store/key, export under the prior authorized configuration, preview/import sanitized fixtures into a separate empty workspace with the new rules, verify, and retain the old backup securely according to your retention obligations. Do not delete original storage automatically. Historical attempt logs are not preserved by fixture migration.

Custom redaction still does not guarantee removal of all personal data, business secrets or free-text identifiers. Missing fields/rule typos require operator review; these rules are not a schema validator. Labels retain default text redaction; JSONPath rules address payloads only.
