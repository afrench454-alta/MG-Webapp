# Development handoff

## Current checkpoint — SETUP, 9 November 2026 (Australia/Sydney)

- Intent: safely install the takeover context and recheck its recommendations; no product implementation.
- Repository: fresh clone in the project source folder at `MG-Webapp`. Branch `chore/takeover-setup`, base `50cf2ae9b7b0db4efdf513f600f0f73786a2f88d` (same as review). Final setup commit is discoverable with `git log -1 --oneline`; no remote branch/PR requested or created.
- Preserved: original root AGENTS.md instructions verbatim as a prefix; existing docs, source, lockfiles, CI and migrations. Appended the proposed takeover rules only. No pre-existing uncommitted work was present.
- Added: all eight overlay docs, `.codex/setup-demo.sh`, `.codex/start-demo.md`, `.codex/verify.sh`; historical REVIEW/SOURCES in `docs/takeover/`; `docs/TAKEOVER_ASSESSMENT.md` with current evidence. Updated the context-loading links. Original kit remains untouched.
- Local runtime: Node 24.19.0, npm 12.0.2. `npm ci --no-audit --no-fund` passed (394 packages). npm reported blocked install scripts for esbuild and unrs-resolver; no policy override was applied, and checks/build subsequently passed. No lockfile changed.
- `npm run check`: passed after setting process-only `npm_config_script_shell` to the running PowerShell 7 executable. Lint/typecheck passed, 148 unit tests passed, migration source checks passed (23/23 RLS tables). Default Windows cmd execution breaks on the `&` in this folder path; no repository npm setting was changed.
- `npm run build`: passed outside the sandbox in demo configuration, without the historical networkInterfaces shim. The sandboxed attempt stalled during compile and was interrupted; it is not counted as a pass.
- Playwright: `node node_modules/@playwright/test/cli.js test --workers=2` passed outside the sandbox: 15/15, including phone shell/overflow checks. The same process-only shell setting allows its checked-in npm webServer command. Pause the ordinary dev preview first: Next permits one dev server per checkout, so preview 3000 and suite 3100 cannot run concurrently here. Initial attempts met this server lock and did not run tests; the completed run did.
- `npm audit --audit-level=moderate`: completed, failed severity threshold with 14 reported vulnerabilities (8 moderate, 5 high, 1 critical). No automatic fixes applied. See assessment for verified maintainer advisory links and applicability limits.
- Synthetic pure-function checks reproduced inferred $100 payment on a $200 invoice, planned voiding of $75 on “Unpaid”, seven-day reopened terms and dropped create scope/label/unit. No database contacted.
- Preview: `http://127.0.0.1:3000`, loopback-only demo; Supabase and optional AI variables explicitly cleared. Restored after the suite, HTTP 200 and dashboard verified in Chromium; opened/closed an empty New Client dialog without saving. Existing browser suite exercised demo screens and synthetic owner rename.
- Remaining limits: no published cloud environment, deterministic fixture implementation, live two-tenant DB round trip, rollback/concurrency verification, PDF visual pass, axe or full assistive-technology audit. Existing invoice E2E still conditionally skips its Issue assertion when no draft is present; green smoke tests do not validate the ledger.
- Recommended next single task: SEC-01, a focused dependency advisory triage and compatible patch PR with check/build/browser verification; then FIN-01 actual payment recording/canonical balances with a local disposable database. DOC-01 precedes broader direct invoicing. AI confirmation moves forward if mutating Joseph features are active.
- Production authorization/performed: none. No deploy, push, merge, hosted database connection/mutation, migration execution, external message, document send, access change or paid-service activation.

### Resume on Windows PowerShell 7

Run from `MG-Webapp`. Do not copy `.env.example` placeholders into the demo.

```powershell
git status --short
git branch --show-current
$env:npm_config_script_shell = (Get-Process -Id $PID).Path
$env:NEXT_PUBLIC_SUPABASE_URL = ''
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ''
$env:GEMINI_API_KEY = ''
$env:GOOGLE_API_KEY = ''
$env:XAI_API_KEY = ''
$env:OPENROUTER_API_KEY = ''
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run check
npm run build
# Stop preview 3000 before the browser suite:
node node_modules/@playwright/test/cli.js test --workers=2
# Start preview after the suite, outside the sandbox on Windows:
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000
```

## Historical kit checkpoint (preserved)

As of 9 November 2026, the takeover review and configuration proposal are complete. Product code is unchanged. Reviewed source `50cf2ae9b7b0db4efdf513f600f0f73786a2f88d`. No PR, merge, database migration, external message or deployment performed.

### Historical verified baseline

Lint/typecheck passed; 148 unit tests passed with Node --import tsx (tsx CLI IPC blocked); static migration checks passed; production build passed with a temporary review-host networkInterfaces workaround. Browser E2E/axe/visual/PDF checks blocked; live authenticated DB workflows not run. npm audit produced no usable report. See the takeover REVIEW.md for exact scope.

### Historical next task

Run bootstrap prompt, check current SHA and preserve any newer instructions, install these docs in an isolated branch, publish/verify a runnable demo environment. Then fix actual payment recording and remaining balance before broad billing redesign.

## Update this after every task

- Task ID and intent:
- Branch/base SHA/new SHA or uncommitted state:
- User decisions/assumptions:
- Files changed and why:
- Schema/data changes and exact test target:
- Checks run with results (passed/failed/blocked):
- Preview URL and demonstrated states:
- PR URL if created:
- Outstanding blockers/risk:
- Next single task:
- Commands needed to resume:
- Production actions explicitly authorized/performed:

Do not store secrets, real customer names, payment account details or sensitive test traces here. A handoff is a factual checkpoint, not proof the current checkout still matches it.

## Workflow demo checkpoint — 16 November 2026

The feature implementation was transferred into the app-managed worktree from the original isolated branch. The original checkout still contains the sign-in and dependency commits. The managed review branch uses those two commits as its base.

- Phone Today/Jobs/More, job status filters and record bookmarks, request close/reopen, direct work and billing entry, invoice ledger and snapshots, role-filtered alerts, and reviewed Joseph actions are available in the synthetic preview.
- Use `/?demo=populated` for the manager walkthrough or `/?demo=field` for the technician walkthrough. Record changes in these modes are scoped to the browser tab.
- All 16 migrations and the three SQL suites ran on disposable Postgres via PGlite with local Auth/Storage shims. This verified business rules, grants, RLS, rollback, and replay in PostgreSQL. Full Supabase Auth, PostgREST/Storage transport and multi-connection race testing still require a disposable Supabase stack.
- Runtime dependency audit found zero findings. Full audit found seven moderate and two high findings in development tooling. The CSP remains report-only pending verification with the authenticated app.
- Rollback for the demo is to use the previously verified branch/base and reset only the disposable database. For any future release, rehearse application rollback against the new schema before promoting. New financial write RPCs replace prior direct writes by design, so returning to the old billing application would leave those writes unavailable. Preserve newly recorded payments, audit history and issued snapshots. A release rollback should use a forward compatibility fix or a tested restore in an isolated target before any production action.
- Paid-document content adjustments await accounting policy. Existing invoices with no recoverable issued snapshot are marked as legacy in the document UI.
