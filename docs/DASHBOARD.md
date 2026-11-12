# Dashboard and history — v0.3.0

## Product choice

This is a private, single-user staging debugger. Its next useful job is helping a developer answer: what arrived, what was tried, which receiver needs investigation, and what can be reproduced safely? It is not a public webhook gateway or an automatic delivery service.

Capture, filtering and replay are established market capabilities, not a unique-feature claim. Reference products include [Hookdeck](https://hookdeck.com/docs/hookdeck-basics) and [Webhook.site's open-source edition](https://docs.webhook.site/open-source.html). [Stripe's delivery guidance](https://docs.stripe.com/webhooks#event-delivery-behaviors) illustrates why duplicates, ordering and retries must not be hidden behind a simplistic success score. [Hostinger's n8n VPS offering](https://www.hostinger.com/self-hosted-n8n) suggests an adjacent self-hosted integration audience, not proof of customer demand.

Implemented now: retained-data charts, searchable/filterable attempt history, per-event investigation, explicit outcomes, refresh/storage labels and keyboard navigation. Remaining market-parity gaps: native provider verification/adapters, authenticated outbound adapters, full-text JSON query, saved searches, long-lived audit history, delivery queues/retry schedules, alerting, team access/RBAC and production monitoring. These are not implemented or promised by this release. Any outbound auth, public ingress or automated retry work needs a separate security design.

## Interaction and visual design

The interface uses three task views rather than a long stack of forms. Overview answers whether there is something to investigate; Replay history locates an attempt; Workbench puts the captured event next to its redacted content, comparison and safe replay controls. Unknown delivery offers a direct investigation shortcut, not a retry button.

The revised design uses a light neutral canvas, white cards, a restrained blue accent and system fonts. Blue/lavender distinguish captured events from replay starts, while amber highlights investigation needs. Compact chrome, consistent SVG icons, underline tabs, two-column history cards and visible keyboard focus improve visual hierarchy. Status text and the chart table keep meaning independent of color. Capture and replay counts use separate aligned interval plots with straight segments, shared scales, direct labels and distinct line styles. Outcome counts use a distribution strip with exact counts and percentages. The chart table keeps exact values available; empty periods remain zero. Charts need no third-party library or remote fonts. The data is a manual server snapshot, never portrayed as streaming or a complete audit log.

The installed UI UX Pro Max guidance was consulted for data-dense dashboards, loading feedback, readable labels, chart alternatives, keyboard focus and navigation. Its unrelated generated FAQ-landing suggestion was rejected. There is no claim that running a design tool alone constitutes usability or accessibility certification.

## Data and safety boundaries

All displayed records come from the authenticated events API. Capture timestamps and attempt timestamps are separate. The range is `(snapshot time - selected duration, snapshot time]`; buckets use the same start-exclusive/end-inclusive rule. Capture totals count captures in that window. Attempt totals count replay starts in that window, even if the event was captured earlier. The inbox shows all retained captures, independent of the activity filter.

Response latency is the median of nonnegative finite recorded durations for response-received attempts only. Missing durations remain absent. HTTP 2xx is not a business-processing guarantee. Blocked validation, active transport and unknown delivery stay separate. An original event's attempts survive restart only with the existing encrypted store enabled. No response bodies, credentials, tokens or raw incoming headers are added to storage by this feature.

The same 24-hour event retention, 200-event capacity and latest-20-attempt cap apply. Deleting or expiring an event removes its associated history. The interface states these limits and notes that captured synthetic samples are included. No auto-retry, bulk replay, relaxed TLS, public binding or production routing was introduced.

## Verification

- 48 Node tests passed locally (Node 25.2.1), including six new analytics tests: empty states, time boundaries, independent capture/replay timestamps, status classification, missing-duration median, filtering and bounded totals.
- Original browser regression suite passed: double clicks, replay cancellation/expiry, lost responses, stale preparation, token races, comparison/export/delete.
- New dashboard browser suite passed using actual API capture/replay requests with injected synthetic transport and an isolated encrypted store. Restart preserves records; unknown-delivery drilldown, exact counts, search/outcome filters, chart data, keyboard tabs, Back/Forward, failed refresh, expiry and token clearing are verified.
- All three views checked for page overflow at 320, 390, 720, 1024 and 1440 CSS pixels. Reduced motion is exercised. Desktop/mobile screenshots were visually inspected. This is not a manual screen-reader audit or a WCAG certification.
- Read-only source review found a focus loss in the unknown-delivery shortcut; focus now moves to History search and has a regression assertion.

## Reproducible local performance check

Run `PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node test/dashboard-performance.mjs` with an existing Playwright installation.

Measured locally on macOS with Node 25.2.1 and headless Chromium, using 200 synthetic events and 4,000 retained attempts (20 per event), with 20 history cards initially rendered:

- Aggregation plus filtering: median 0.90 ms; p95 1.50 ms across 100 measured iterations after 10 warmups.
- Browser synchronous filtering plus forced layout: median 1.90 ms; p95 2.70 ms across 50 measured iterations after 5 warmups.

These are one-machine microbenchmarks, not an SLA or evidence of being faster than another product. They exclude network, paint, remote receiver time, concurrent users and maximum-size payloads. Re-run on target hardware. Keeping 20 results visible initially avoids building thousands of cards during routine filtering; Show more appends the next batch.
