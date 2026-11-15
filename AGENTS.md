<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Preview URL Requirement (Always Active)
- Whenever you make any changes to any repository, you **MUST** start or ensure the local preview server is running (outside the sandbox on Windows so the user's browser can reach it) and include a clickable preview URL (e.g., `http://localhost:3000`) in your response so the user can immediately preview the new changes.


## Mow & Glow development takeover

Read `docs/PROJECT_CONTEXT.md`, `docs/HANDOFF.md`, and the files relevant to the task. These are working context, not permission to execute the entire backlog. Revalidate old review findings against the checked-out SHA. Keep this root instruction file short; put detail in docs.

### Product priorities
- Make invoicing for completed work a direct action. Requests, quotes, scheduling, and job status progression are optional unless the task explicitly needs them.
- Provide direct quote and job entry. Preserve existing links and operational history.
- Let operators edit relevant draft document fields; preserve issued/accepted history with explicit revisions/corrections.
- Prefer a simple mobile-friendly form with optional details revealed as needed. Target WCAG 2.2 AA and keyboard completion.

### Engineering and integrity
- Preserve the existing Next.js App Router, React, TypeScript, Zod, Supabase and npm stack. Read installed Next.js documentation as required by the framework block above.
- npm/package-lock.json is the current operational path. Do not regenerate another lockfile or silently delete it.
- Never derive a real payment amount from a selected status. Record actual amount/date/method, derive balances/status, use idempotent transactional writes.
- Preserve issue/due/expiry dates and all editable fields across save/reload/print. Compute money with a consistent decimal/minor-unit strategy and documented rounding; no silent rounding policy changes.
- Use transactions for multi-record financial writes. Protect against retries/concurrent issue/edit/pay operations. Enforce tenant, role and lifecycle rules on the trusted server/database path, not only by hiding buttons.
- No live secrets, customer exports or real payment details in fixtures, context docs, traces or screenshots. Use synthetic tenants and test identities. Normal app runtime must not gain a service-role key.
- Preserve RLS, trusted origins, authenticated membership and technician restrictions. A model-supplied confirmation flag is not proof a person approved an action.
- Keep changes focused. Add meaningful regression/integration tests for behavior changes; do not preserve incorrect business behavior merely because a unit test expects it.

### Working scope
- Work on an isolated feature branch/workspace. Do reversible implementation, validation and draft PR preparation within the requested task without repeated permission questions.
- Ask only for decisions that materially change business behavior and cannot be resolved from code/docs. State proposed defaults clearly.
- Do not deploy, merge, mutate a hosted database, send documents/messages, change access or activate paid services unless explicitly authorized for that action. Prepare the concrete diff/plan first.
- Do not execute a hosted migration simply because a migration file exists. Test locally or against the explicitly designated disposable staging target.

### Verification and handoff
- Commands: `npm run check`; `npm run build`; `npx playwright test`. Dependency review: `npm audit --audit-level=moderate` when reachable. Explain blocked checks; never claim they passed.
- For invoice/schema changes, also verify a real isolated DB round trip, transaction rollback, role/tenant denials, duplicate retries and non-default fields. Static migration checks alone are insufficient.
- For UI changes, inspect accessible desktop/mobile states and keyboard behavior. Start/keep a reachable preview per the existing rule; in cloud provide its exposed preview URL, not an inaccessible mobile localhost link. If unavailable, report the concrete blocker.
- Update `docs/HANDOFF.md` and relevant decisions. Report what changed, test evidence, remaining risk and the next task. Preserve any existing uncommitted user work.
