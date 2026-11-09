# Acceptance and verification plan

Run meaningful tests against synthetic data; never issue/send real documents for QA. Record actual evidence and mark blocked checks. Automating axe does not establish WCAG conformance. Source/RLS text checks do not establish live authorization.

## Financial and persistence tests

1. $200 invoice, $75 received: paid amount $75, outstanding $125, payment state Part paid. No inferred $100 or default method.
2. Record remaining $125: paid $200, balance $0, state Paid. Repeated same idempotency key produces no duplicate receipt.
3. Concurrent payment/issue requests have deterministic outcomes; no double payment or duplicate final number. Test partial failures between writes.
4. Refund/reversal records actual amount/date/method/reference, preserves ledger history and cannot produce an impossible balance. Test a refund of a partial payment as well as a full one.
5. “Unpaid” selection cannot silently void actual receipts. Replace status toggles with deliberate payment corrections.
6. Create invoice with no job, quote or request. Verify null optional links in database, not fabricated upstream records.
7. New minimal customer in invoice: save succeeds atomically or rolls back both customer/document; no fake phone or property values.
8. Separate invoice scope, line label, unit, quantities, prices, references, notes and terms survive create, reload and print.
9. Invoice with 30-day terms: open, change only notes, save; issue/due dates remain identical.
10. Quote with a non-default validity date survives reload and shows the same date/validity in PDF.
11. Draft update with item-insert failure leaves prior header/items/properties unchanged.
12. Customer name/address/business payment details change later: previously issued document reprint remains its original snapshot.
13. Two simultaneous draft editors: stale save reports conflict; neither silently overwrites the other.
14. Issued invoice/accepted quote cannot be silently re-priced through UI, server action or direct Data API; correction preserves original and links revision.
15. Draft totals, list totals, document/PDF and DB agree for decimals, zero tax, multiple lines, discounts if implemented, and refund scenarios.
16. Internal note sentinel never appears in customer view, public document, PDF or outgoing payload. Remove internal_notes fallback to printed notes.

## Direct business workflows

17. Existing-customer invoice: one composer, no forced directory/request/quote/calendar detour.
18. New-customer invoice: inline add preserves entered items and resumes composer.
19. Direct quote for new/existing customer without request; no artificial request created.
20. Direct future/finished job without a request. Optional record-completed-job path does not schedule a fictional visit.
21. Accepted quote → invoice copies supported fields once and permits draft edits; repeating conversion handles existing invoice intentionally.
22. Completed job → invoice prefill; invoice creation does not complete/cancel another job or spawn recurrence.
23. Recurring job completion spawns at most one next occurrence; direct completion and retry behave consistently.
24. Draft save, issue, mark sent and record payment have distinct observable effects. Mark sent does not falsely claim email delivery.

## Navigation and accessibility

25. Bookmark/refresh/back/forward restore primary route and selected record; sensible focus/title after navigation.
26. Keyboard-only completion of invoice, quote, client add and all job-status actions, including alternatives to dragging.
27. Dialog initial focus, Tab/Shift+Tab containment, Escape policy, background inertness and focus restoration, including disabled/hidden/pending controls.
28. Pickers with zero, eight and nine-plus options: distinct labels for filter/select, associated hints, no duplicate IDs, accessible required/error state.
29. Invalid fields: preserved values, actionable inline errors plus linked summary, focus first error, screen-reader announcement without losing typing focus.
30. 320/390/768/1440px viewports, 200% text resize, and 400% desktop zoom/reflow: no essential clipped content, keyboard focus or actions hidden behind sticky bars. Data tables can use applicable reflow exceptions; forms should not require two-dimensional scrolling.
31. Light/dark themes: measured contrast (4.5:1 normal text; 3:1 large text and applicable UI), visible focus, no color-only status. WCAG target-size minimum 24px with spacing/exceptions; prefer 44px primary touch targets.
32. iOS VoiceOver/Safari and desktop NVDA/Chrome spot checks: labels, headings, order, totals, saved/error status and action names. Automated axe checks for key empty/populated/error/dialog states; triage findings rather than suppressing broadly.
33. Close/backdrop/Escape/navigation with changed draft: recover or explicitly discard; no lost input on network failure. Pending save cannot be duplicated by repeated click.
34. PDF/print: A4, one line and many long lines/multiple pages, long customer/site names, notes, totals, pagination, no internal controls, correct non-GST label. Compare visible output to persisted data.

## Authorization and operations

35. Two tenants, owner/co-owner/technician/anonymous: allowed and denied select/insert/update/delete/RPC/storage cases; direct API as well as UI. Test forged cross-tenant IDs and lifecycle bypass. No service-role shortcut in normal web test path.
36. AI: model-supplied confirm=true without valid user confirmation token cannot mutate. Valid token bound to actor/tenant/action/payload/version expires, is single-use, and cannot execute a different target. Technician financial writes denied.
37. Production auth/session/trusted-origin behavior unchanged; staging callback redirects do not trust arbitrary host headers. Document logs avoid sensitive values.
38. Offline/connection loss: honest status, retained draft and retry behavior; no false “saved/sent” message or duplicated transaction after reconnect.
39. Fresh environment checkout, npm ci, check, build and browser tests reproducible on chosen Node LTS. Hosted migration history is separately inspected before any release.
40. Field p75 LCP≤2.5s, INP≤200ms, CLS≤0.1 measured on relevant production routes/mobile/desktop when authorized. Lab measurements support diagnosis, not a fabricated field score.

## Checked-in commands

```bash
npm ci
npm run check
npm run build
npx playwright test
npm audit --audit-level=moderate
```

Add database integration and accessibility scripts only when implemented; do not claim they already exist. Playwright test server port is 3100; ordinary preview is 3000. If a test condition is required, assert the fixture/control exists; do not wrap critical assertions in a visibility condition that makes an empty test pass.

## Human validation

Use a synthetic mowing/cleaning invoice scenario matching typical real work, then ask the owner and co-owner to complete it on their actual devices. Record completion time, errors and confusing decisions. Provisional targets: ≤60s existing customer, ≤90s new customer for a simple invoice; these targets have not yet been measured or approved.
