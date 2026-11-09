# Project context

Business: Mow & Glow Property Services. Product: Mow & Glow Console. Primary operator goal: less repetitive administration while keeping billing and operational records accurate.

## Context loading

1. Read root AGENTS.md and HANDOFF.md.
2. Read the task's relevant WORKFLOW_PROPOSAL, DOCUMENT_FIELDS, ACCEPTANCE_TESTS or BACKLOG section.
3. Inspect actual current code/tests and deployed/staging configuration when relevant.
4. Consult `docs/takeover/REVIEW.md` and `docs/takeover/SOURCES.md` for historical evidence and standards, and `docs/TAKEOVER_ASSESSMENT.md` for the bootstrap recheck. Do not load the whole kit for every small task.

Review baseline: `50cf2ae9b7b0db4efdf513f600f0f73786a2f88d` on 9 November 2026. Source is current truth; proposal docs are not automatically implemented or approved. No external credentials are required for demo UI work.

## Repository map

| Concern | Paths |
|---|---|
| App entry/live data assembly | src/app/page.tsx |
| Console state, view/dialog wiring | src/features/console/console-app.tsx |
| Models and shared document terms | src/features/console/domain.ts |
| View and form UI | src/features/console/views/, dialogs/, components/ |
| Draft validation/action types | src/features/console/data/operations-contract.ts |
| Business rules and lifecycle | operations-rules.ts, invoice-lifecycle.ts, quote-invoice.ts |
| Server mutations and persistence | operations-actions.ts, operations-repository.ts |
| Client identity/property validation | client-contract.ts, client-repository.ts |
| Auth/business membership | src/lib/supabase/, src/proxy.ts |
| AI action loop/tool execution | joseph-actions.ts, joseph-tools.ts |
| Database schema/policies/functions | supabase/migrations/ |
| Unit/browser checks | tests/unit/, tests/e2e/, playwright.config.ts |
| Build/CI | package.json, package-lock.json, .github/workflows/ci.yml |

## Verified baseline

Next 16.3.0, React 19.2.4, TypeScript, Tailwind, Zod, Supabase. npm is used by CI/README; pnpm lock also exists. CI currently Node 20; move to supported Node 24 LTS in a dedicated compatibility change. Review host Node 24.22.1 passed build and 148 unit tests with documented environmental workarounds; browser checks were blocked. Do not repeat those results as if checks ran on a newer commit.

Demo: both public Supabase variables absent. Live: both configured, authenticated business data. No partial configuration. Demo seeds are mostly empty; current demo quote creation has hardcoded identity/date behavior, so fix fixtures before relying on it for document QA.

## Business rules to preserve

Owner/co-owner financial management; technicians have constrained field actions. No service-role key in normal web runtime. Issued document history and actual payment records must survive customer/profile changes. Invoice, payment, delivery and job progress are different facts. Simplify interactions without deleting those distinctions.

## Known evidence-backed starting issues

P0 payment amount inference; P1 unpaid balance aggregation; required client/property creation before invoice; request-bound quotes/jobs; missing persisted invoice scope/units; seven-day edit default; non-transactional updates; mutable historical document rendering; model-controlled AI confirmation. See BACKLOG for order, not blanket authorization.
