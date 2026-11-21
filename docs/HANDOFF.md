# Mow & Glow development handoff

## Canonical checkout

`C:\Users\DeV OP\.codex\worktrees\mg-workflow-demo\MG-Webapp` on `feat/mg-workflow-review`. The workflow implementation under review is `41131d1`. The primary `MG-Webapp` checkout on `chore/takeover-setup` owns the shared Git metadata. Keep it in place.

The old demo checkout was retired after archiving 77 files and preserving their Git versions in `feat/mg-workflow-demo` at `cec896d`. Its archive, comparison ledger and cleanup measurements are in the project-level `phase-evidence` directory. Cleanup removed 1,923,164,873 logical bytes of generated files. Free space increased by 2,503,966,720 bytes during the cleanup window.

## Operator walkthrough

Open the [populated synthetic preview](http://127.0.0.1:3003/?demo=populated) on the Windows host. Open the [technician preview](http://127.0.0.1:3003/?demo=field) to check the field navigation. Demo changes remain in the browser tab.

- **Invoice completed work.** Open Invoices and create an invoice. Choose a client or add a name-only client, then enter dates, scope and line items. Save the draft, reopen it to review its values, and issue it when ready. A request, quote or scheduled visit is optional. Mark an invoice as sent only after actual delivery.
- **Book or quote work.** Start a direct job from Schedule and choose the client and service address. To quote that visit, open the job and choose Create quote. The draft inherits the client and service site. Reopen the job to find the saved quote. When the quote is accepted, follow it to the invoice. If an accepted revision refers to a visit already billed, open that visit's existing invoice.
- **Record money received.** Open the issued invoice and use Record payment. Enter the actual amount, payment date and method. Reopen the invoice and confirm the ledger and remaining balance before collecting the remainder. For an erroneous receipt, use the linked payment correction with a reason.
- **Correct an issued document.** Use the linked replacement flow for eligible issued invoices without payment history. Review the replacement before issuing it and keep the original in the history. Paid-document content correction stays restricted pending accounting policy.

## Candidate checks

The release review caught three billing issues. The candidate rounds each quote line the same way as PostgreSQL, reads beyond the first page of financial rows, and checks the reviewed quote version on a status change. Lint, type checking, 154 unit tests, all 19 Chromium demo tests and the production build passed. Runtime and full npm audits both returned zero findings after updating transitive development tooling. The independent review also tightened the proposed Supabase denial assertions. The Windows host cannot run the pinned local Supabase CLI without a container runtime.

## What remains

Use [the release checklist](RELEASE_CHECKLIST.md) for verification, migration order and recovery. Start the full-stack suite on disposable Docker or Podman as described in [the environment contract](ENVIRONMENT.md). Then complete authenticated browser workflows, CSP reports, iPhone and VoiceOver acceptance, and restore or forward recovery rehearsal. Production deployment and hosted migrations await separate authorization.

The earlier takeover evidence and implementation history are available in Git, including the handoff at `41131d1`.
