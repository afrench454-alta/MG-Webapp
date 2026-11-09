# Decision log

## Proposed defaults from the takeover review

| ID | Decision/proposal | Status and reason |
|---|---|---|
| D01 | Evolve existing Next/React/Supabase/Vercel stack | Recommended; no evidence justifies rewrite |
| D02 | Direct invoice path with optional job/request/quote links | Recommended from explicit owner friction |
| D03 | Inline minimal customer; phone and site optional where not needed | Proposed; requires schema/RPC coordination, not fake placeholders |
| D04 | Job board initially simpler views on existing statuses | Proposed; protects history/reports while reducing operator steps |
| D05 | Draft fields editable; issued/accepted documents retain originals | Recommended integrity constraint; correction mechanics still to define |
| D06 | Non-GST behavior stays until actual registration verified | Current code assumption only; not confirmed business fact |
| D07 | Actual ledger entries determine payment state/balance | Required correctness; never infer half-payment |
| D08 | npm/package-lock as operational dependency path | Matches current CI/README; alternate lockfile retirement separate |
| D09 | Node 24 supported LTS target | Proposed and locally exercised; align CI/Vercel through tested PR |
| D10 | WCAG 2.2 AA plus practical mobile touch sizing | Proposed quality target, not a present conformance claim |
| D11 | Demo first, isolated live staging for persistence/RLS | Recommended; no production secret needed for UI |
| D12 | Model proposals cannot authorize their own writes | Recommended; user approval bound on trusted server |

## Ask only when implementation reaches these decisions

- Actual GST registration and any tax-treatment changes: determines invoice labeling and tax fields; do not guess from code text.
- How the owner wants corrections of already-issued/paid documents handled, with accounting input when needed; preserve originals meanwhile.
- Whether customers can be created without phone/site for normal billing, and what information is required for the chosen delivery method. Recommendation is minimal customer plus optional site, not deletion of useful customer data.
- Whether invoice-only work should optionally create a completed job by default. Recommendation: invoice only unless requested, so reports do not gain surprising work entries.
- Which current stages/actions the owner/co-owner actually use each week. Begin with direct shortcuts and simpler views before deleting workflow concepts.

Do not ask all of these as a gate to documentation, read-only review, fixtures or clearly scoped fixes. A later task should ask only the decision it needs, explain its consequence, and continue independent work.

## Entry template

Date; decision; status (proposed/approved/implemented); owner; reasoning; alternatives; affected files/data; verification/rollback; supersedes. Never mark a recommendation approved simply because it appears in this kit.
