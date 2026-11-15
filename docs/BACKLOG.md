# Mow & Glow improvement backlog

Use this table as the implementation sequence and verification ledger. The approved plan in the project chat supplies acceptance criteria. The feature worktree starts at `a36602b`. Use synthetic demo data and a disposable authenticated database.

| Order | Task | Priority | Status and evidence |
|---|---|---|---|
| 1 | SETUP / SEC-01 / OPS-01 | P0 | Sign-in fix `7e68253` and dependency update `52b4a0e` applied in separate commits. Node 24 CI, manager/technician fixtures and report-only CSP added. Runtime audit clear; nine tooling findings remain. |
| 2 | MOB-01 / NAV-01 | P1 | Today, Jobs and More for phone; search and alerts; bookmarkable view and record. Implemented for local review. |
| 3 | MOB-02 / MOB-03 / JOB-03 | P1 | Today and all job statuses reachable on phone, shared contextual card actions and desktop board. Implemented for local review. |
| 4 | JOB-04 / REQ-01 / REQ-03 | P1 | Valid transitions, atomic recurrence, close and reopen requests, preserve intake. Implemented for local review. |
| 5 | FIN-01 / DOC-01 | P0 | Explicit ledger payments, atomic document editing and stable totals, dates and fields. Required before new billing paths. Implemented for local review. |
| 6 | JOB-01 / JOB-02 / INV-01 / QUO-01 / REQ-02 | P1 | Shared client selection, inline creation, calendar booking and optional-quote paths. Job Request is the visible invoice work field. Implemented for local review. |
| 7 | HIST-01 | P1 | Editable drafts, issued snapshots and linked replacements or revisions. Paid-document content correction awaits accounting policy. Implemented for local review. |
| 8 | NOT-01 | P1 | Shared role-filtered alerts and badge based on outstanding actionable work. Implemented for local review. |
| 9 | A11Y-01 / AI-01 | P1 | Accessible control states, draft recovery and server-verified Joseph approval. Implemented for local review. |

## Workflow rules

- Keep the current job data for visits. Invoices can originate from a request with no non-cancelled visits, a completed visit, an accepted quote or standalone entry. Lock and validate related sources together, reuse existing invoices, and keep legacy duplicates for review.
- New drafts may use a name-only client. Scheduling needs a service address. Delivery needs the chosen contact method.
- Completed and Cancelled are terminal during ordinary job operations. Closing a request preserves its relationships and prior status.
- Run lint, typecheck, unit and migration checks, production build, Playwright, both dependency audits, and fresh and legacy-shaped database integration tests. Record any unavailable verification. Retain a clickable demo and a previous verified revision. Keep changes out of production.

## Superpowers checkpoint

Planning and implementation are recorded in this backlog. The managed worktree is the current review target. Superpowers stage: implementation and final review completed for the demo. Release verification remains open. SQL scenarios cover direct booking, job request state, ledger amounts and replay, immutable issued records, source collisions, and explicit Joseph confirmation. Keep remaining deployment verification open until it runs on a full disposable Supabase stack and an actual iOS device.

- Acceptance evidence: lint and TypeScript checks, 150 unit tests, production build, 18 Chromium tests, plus all 16 migrations and three SQL suites in disposable Postgres. The browser suite covered rescheduling, phone status filters and bookmarks, a 51-item alert list with one urgent item, and report-only CSP. Preview: http://127.0.0.1:3002/?demo=populated.
