# Takeover assessment — 9 November 2026

## Scope and source

The project source folder initially contained only `mg-codex-takeover`, with no repository checkout. A fresh clone of `afrench454-alta/MG-Webapp` was created in `MG-Webapp`; `main` resolves to `50cf2ae9b7b0db4efdf513f600f0f73786a2f88d`, exactly the review baseline. The checkout was clean before creating `chore/takeover-setup`. Consequently there are no later source changes that invalidate the review. This is source/demo verification, not a production audit.

The original root AGENTS.md was compared with the kit's pre-takeover section. They match after line-ending normalization. The original file bytes were retained as a prefix and only the takeover section appended. All eight overlay docs and three proposed `.codex` demo scripts were copied with overwrite disabled. Existing `docs/superpowers/` and `docs/security-hardening-2026-10.md` were preserved. Historical review and sources are archived in `docs/takeover/`; the original kit remains untouched outside this checkout.

## Recommendation

1. **SEC-01: triage and patch the locked dependency vulnerabilities in a separate, tested change.** The fresh `npm audit --audit-level=moderate` completed and returned 14 vulnerabilities: 8 moderate, 5 high, 1 critical. The original review had no usable audit result. Next.js 16.3.0 falls within the maintainer's affected ranges for [Windows server RCE](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) and [AVIF image optimization RCE](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4). Both advisories identify 16.3.3 as a fix for those specific issues; npm's aggregate report proposes 16.4.5 for the collected Next advisories. Verify all advisory ranges and compatibility before selecting the upgrade; do not run `npm audit fix --force` blindly (it also proposes an eslint-config-next downgrade). Audit also reports sharp, Zod and tooling dependency issues. Production applicability depends on deployed version, OS and exercised features; none were inspected. Keep this Windows demo bound to loopback. No dependency upgrade is included in this bootstrap.
2. **FIN-01: actual payment entry and canonical balances.** This remains the first product behavior correction. Establish a local disposable database with synthetic tenants and roles; replace payment-status inference with deliberate amount/date/method/reference entry, transactional writes, idempotency keys and concurrency protection. Use database `amount_paid` and `balance_due` throughout list/dashboard/document models. Preserve receipts and implement deliberate corrections instead of silently voiding them.
3. **DOC-01**, then **INV-01**: protect scope, units and dates across atomic save/reload/print before expanding direct invoice/customer entry. Prioritize the internal-note fallback removal within document work. Pull AI confirmation protection forward if Joseph's mutating features are actively used.

FIN-01 acceptance: a $200 invoice with a real $75 receipt must show paid $75 and balance $125; recording the remaining $125 yields zero balance; replay cannot duplicate a receipt; concurrent operations and injected failures preserve the ledger; refund/correction behavior is deliberate; two-tenant and technician denials hold through the direct API. Follow ACCEPTANCE_TESTS 1–5, 15 and 35. A passing unit suite alone is insufficient.

## Current code checked against the review

| Review | Current evidence | Assessment |
|---|---|---|
| F01 | `data/invoice-lifecycle.ts`, `planInvoicePaymentRecords`; `operations-repository.ts`, `syncInvoicePaymentRecords`; existing lifecycle unit tests | Still infers half the total and bank transfer. “Unpaid” plans to void existing recorded receipts. Executed synthetically without DB access. |
| F02 | `views/invoices-view.tsx`, outstanding reducer; `operations-repository.ts`, INVOICE_SELECT/mapInvoice; initial migration | Open invoices contribute full totals; canonical DB paid/balance fields are not selected/mapped. |
| F03–F04 | `operations-contract.ts`, `client-contract.ts`, invoice/quote forms; create-invoice RPC migration | Invoice job/quote links are optional, client/property required; phone required for client mutation; quote/schedule require request. |
| F05–F07 | `operations-rules.ts`, invoiceCreateRpcArgs; `quote-invoice.ts`, draftInvoiceFromRecord; repository update/mapInvoice | Create omits separate scope, line label and unit; update omits scope; read rebuilds scope from items. Reopen sets dueDays to 7; update recomputes due date. |
| F08–F11 | Invoice/quote forms, repository writes, `domain.ts`, document dialog and migration policies | Limited fields/fixed terms, separate update requests, current customer/profile lookups and draft-only app guards remain. Live lifecycle enforcement and original-document snapshots remain unverified. |
| F12 | `joseph-actions.ts` tool loop and `joseph-tools.ts` confirmSchema | Model-supplied boolean still controls confirmation; no trusted user confirmation token in the reviewed path. |
| F13–F18 | `console-app.tsx`, shared Dialog, Field and EntityPicker, operation actions | Local-state navigation, absent dirty guard, focus-effect/selector risks, multiple labelable controls and unguarded awaited document-save callbacks remain. Browser reproduction is distinct from source evidence. |
| F19–F20 | CSS and `tests/e2e/demo-console.spec.ts`; demo persistQuote | Measured accessibility coverage still needed; lifecycle spec conditionally avoids assertions if Issue is absent. Demo quote creation still substitutes fixed identity/address/dates. |
| F21–F24 | `.github/workflows/ci.yml`, README/lockfiles, list repositories, `src/app/page.tsx`, `public/sw.js` | CI still specifies Node 20, npm/pnpm drift remains, eager unpaginated loading and asset-cache-only offline behavior remain. No production performance claim. |

Paths beginning `data/`, `views/` or naming console components above are under `src/features/console/`. See archived REVIEW for individual source links and the limits of each finding.

## Synthetic reproduction

Using Node with the installed tsx import hook and a synthetic $200 invoice (2.5 hours at $80), without importing server repositories or contacting a database:

- `planInvoicePaymentRecords(invoice, "Part paid", 0)` returns a $100 recorded bank-transfer insertion.
- `planInvoicePaymentRecords(invoice, "Unpaid", 75)` returns `voidRecorded: true`.
- `draftInvoiceFromRecord` on an invoice due 30 days after issue returns `dueDays: "7"`.
- `invoiceCreateRpcArgs` receives separate scope, label and unit, but emits only description/quantity/rate for the line and no separate scope.

## Setup limits

This branch installs context and helper scripts only. No product code, lockfile, CI, migration or deployment setting was changed. Demo has no Supabase/provider credentials or real customer fixtures. No hosted database connection, migration, document sending, deployment, push or merge is part of this task. The `.codex` shell scripts are proposals for an eventual Linux environment; copying them does not publish a Codex cloud environment or establish deterministic fixtures. Current verification results and Windows startup commands are recorded in HANDOFF.
