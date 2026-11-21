# Mow & Glow release checklist

Local review candidate on `feat/mg-workflow-review`, based on workflow commit `41131d1` and compared with `main` at `50cf2ae`. Release approval is pending the checks below.

## Evidence

- [x] Preserved the former demo worktree before retiring it. Recovery commit `cec896d` and a verified byte-for-byte archive are available. The primary repository still owns the shared Git metadata.
- [x] Ran `npm run check`, `npm run build` and `npx playwright test --workers=2` on the candidate with Node 24.19.0 and npm 12.0.2. All 154 unit and 22 Chromium tests passed. The Chromium suite used synthetic demo mode, including scheduling a request visit, issuing its invoice and reloading both documents after issuing a linked replacement. The replacement preserved the original line and moved the visit to the replacement invoice.
- [x] Ran the three integrity suites after applying all 17 migrations to disposable PostgreSQL 17.11 with synthetic Auth and Storage shims. The legacy duplicate pair survived upgrade and its draft could not be issued. Separate connections verified the quote-creation race, job-versus-quote billing race, payment replay and overpayment handling.
- [x] Fixed per-line quote rounding, complete billing reads over multiple pages, and quote status writes tied to the version reviewed. The three targeted regressions and the full local suites passed.
- [x] Ran fresh `npm audit --omit=dev` and `npm audit` against the updated candidate lockfile. Both returned zero findings after compatible transitive development-tool updates.
- [x] Verified the old invoice RPC is absent and older direct billing writes fail. An isolated copy of the upgraded PostgreSQL database retained payments, the issued snapshot, source links and audit events.
- [x] Checked the review preview from Windows. It returned HTTP 200 with a report-only CSP header.
- [ ] Run the Supabase integration job on a fresh disposable host. Confirm the migrations and seed, genuine Auth sessions, PostgREST read/write boundaries, payment persistence and Storage permissions. Windows CLI 2.111.0 could not start the stack because Docker and Podman were unavailable. The integration script parsed and stopped at that prerequisite. The full-stack CI job has yet to run. It includes an authenticated Chromium check for interrupted draft saves, persisted billing, payment and report-only CSP.
- [ ] Exercise the authenticated UI from request or direct booking through invoice and payment. Reload records and check persisted dates, units, scope and replacement history. Check recovery after a stale draft, expired session, rejected write and interrupted save. Also exercise Joseph approval through authenticated server actions and review CSP reports. Keep CSP report-only until the authenticated checks pass.
- [ ] Use a physical iPhone and VoiceOver over a trusted test connection. Cover Today/Jobs, quote entry, payments, dialogs, touch keyboard, focus order and return, zoom/reflow, and print. The iPhone 12 mini opened the Wi-Fi preview and the operator reported a squeezed layout. The updated header, quote and payment passed in local WebKit. Confirm the revised layout on the physical device and complete the acceptance steps.
- [ ] Rehearse the full Supabase legacy upgrade and isolated restore or forward recovery. Verify retained payments, issued snapshots, audit history and source links.

The Chromium A4 pass at `3491a34` covered a one-line invoice, a 32-line invoice across three pages and a quote with two fractional-cent lines. Each page was visually inspected. PDF text checks confirmed repeated column headings, all line items, expected totals and exclusion of internal notes. See the project-level `phase-evidence/a4-3491a34` directory for the preserved synthetic samples. Physical Safari print remains open.

## iPhone acceptance

1. Open the synthetic preview in Safari on the same trusted network. On the phone dock, move between Today, Jobs and More. Open a job, try a status filter and check that the page stays within the screen.
2. Open a completed, unlinked synthetic job and choose Create quote. Check the customer and service site, enter a line and change the expiry, then save. Reopen the job to find the quote. Check the keyboard leaves the focused field and Save control reachable.
3. In Invoices, open an issued synthetic invoice with a balance. Record a partial payment and reopen it to confirm the ledger and balance. Open Save / Print PDF and check the print preview.
4. Enable VoiceOver. Swipe through Today, Jobs, quote and payment dialogs and check labels, focus order, announcement of errors and focus returning to the opening control when a dialog closes. Record the iPhone model, iOS version, failed step and any screen reader behavior.
5. Before release, repeat the key workflow checks in the authenticated app using the disposable Supabase stack.

## Migration and recovery

1. Confirm the review commit, target and migration history. Rehearse with synthetic data from empty and with legacy-shaped records. Apply migrations in repository order. Keep the invoice ledger/draft migration (`202611151101`) ahead of job and quote lifecycle changes, Joseph confirmation and the final direct-job quote linking migration (`20261115192007`).
2. Before any approved release, confirm backups and the ability to isolate and restore a copy. Record counts and representative IDs, amounts, document versions and source links for reconciliation. Schedule a short billing write pause around schema/application cutover so clients on the old app cannot continue billing against the new schema.
3. If the new app fails, pause billing writes and preserve the upgraded database and its new records. The old invoice creation RPC is removed and older direct invoice and payment writes are revoked. Reverting the app alone cannot restore billing. Keep the upgraded schema and redeploy a compatible app build or fix forward through the current invoicing RPCs.
4. If considering a database restore, rehearse from a separate upgraded backup and reconcile all writes since the snapshot, especially payments, issued documents and replacement history. Resume billing only after record and balance checks pass. A restore before cutover would omit any new writes, so require an independently verified recovery procedure before production.

## Open decisions

- Paid-document content correction requires an accounting policy. Preserve the issued snapshot and existing payment ledger. Use the supported ledger correction only for the underlying payment event.
- Confirm the named release target and approve the specific deployment and migration procedure after all release gates pass.
