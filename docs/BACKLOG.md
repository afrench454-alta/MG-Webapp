# Ordered takeover backlog

These are proposed task boundaries, not authorization to run all work at once. Each implementation task must inspect current code, add relevant acceptance tests, provide a usable preview when possible, and update HANDOFF.

Bootstrap recheck, 9 November 2026: a completed dependency audit now reports 14 vulnerabilities, including a critical Next.js finding. Recommend a focused SEC-01 advisory triage/compatible dependency patch before FIN-01. This supplements the original order below; it does not authorize an upgrade or production release. See TAKEOVER_ASSESSMENT.md and HANDOFF.md for evidence and current verification.

| Order/ID | Scope and deliverable | Main dependencies | Done evidence |
|---|---|---|---|
| 0 / SETUP | Install context docs safely, validate runnable cloud demo, deterministic fixtures, runtime-alignment plan | GitHub/environment access | Current SHA, check/build/browser baseline with honest blockers; docs-only/config diff |
| 1 / FIN-01 | Actual payment entry and canonical paid/balance UI; remove synthetic payment inference | Disposable staging for integration | Acceptance 1–5, 15, 35; no duplicate receipts; existing records preserved |
| 2 / DOC-01 | Preserve scope/units/dates; atomic draft create/update and quote linkage; safe failure handling | FIN-01 test primitives, migration design | Acceptance 8–11, 13, 15–16, 33 |
| 3 / INV-01 | Direct invoice composer, inline customer, optional site/job, explicit review/issue | Correct persistence/transactions | Acceptance 6–9, 17–18, 24; no fabricated upstream records |
| 4 / QUO-01 | Request-independent quotes, editable dates/terms/reference | Shared composer/customer primitives | Acceptance 10, 19, 21, 34 |
| 5 / HIST-01 | Issued/accepted snapshots and linked correction/revision workflow, DB lifecycle invariants | Owner accounting-policy decision; existing-data strategy | Acceptance 12–14, 16, 35; original preserved |
| 6 / JOB-01 | Direct job/finished-work entry and simpler board views on existing statuses | Shared entity selection; recurrence tests | Acceptance 20–23, 26; no historical-status deletion |
| 7 / NAV-01 | Durable routes, consistent Create entry points, clearer nav/action hierarchy | Current view/record links and user feedback | Acceptance 25, 30, 33; old links handled |
| 8 / A11Y-01 | Shared modal, field/picker, focus/error semantics and measured mobile/contrast fixes | Browser environment/fixtures | Acceptance 26–34 across key states |
| 9 / AI-01 | Server-verifiable AI action confirmation; scoped action previews and privacy/cost controls | Typed transaction layer | Acceptance 35–36; model cannot self-approve |
| 10 / OPS-01 | Supported runtime, accurate docs/lockfile policy, CI integration/axe checks, measured loading, offline clarity | Runtime choice and staging | Acceptance 37–40, environment reproducibility |

P1 security/integrity work such as AI confirmation or lifecycle invariants can be pulled forward if those features are actively used; do not interpret table order as “safe to ignore until later.” Address inexpensive shared accessibility repairs within affected tasks instead of deferring all accessibility.

No estimates are promised before authenticated workflow tests and staging schema verification. Prefer small compatibility-preserving PRs. Keep schema changes additive, document backfill behavior, verify deployed old/new code compatibility, and write a concrete release/rollback plan before touching production.
