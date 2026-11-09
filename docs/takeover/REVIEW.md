# Independent review — Mow & Glow Console

**Recommendation:** evolve the existing application around direct business tasks. The largest practical improvement is a complete “Create invoice” path that does not require a request, quote, scheduled visit or completed job. Keep those features for work that needs them. Correct financial-record behavior before expanding document editing.

Reviewed 9 November 2026. Repository: [afrench454-alta/MG-Webapp](https://github.com/afrench454-alta/MG-Webapp), `main` at `50cf2ae9b7b0db4efdf513f600f0f73786a2f88d`. Live entry point: [mg-webapp-host.vercel.app](https://mg-webapp-host.vercel.app).

## What was actually reviewed

- Authenticated GitHub repository access and a clean local clone; current app entry point, console shell, invoice/quote/client forms, document rendering, workflow contracts, repositories, payment functions, relevant migrations, auth context, service worker, CI and test coverage.
- Live public site opened in a browser: it redirects to `/sign-in?next=%2F` and shows a restrained sign-in screen with labelled email/password inputs. Authenticated screens were not accessible in the supplied session.
- Exa returned 30 search results across six research areas: OpenAI configuration, accessibility, form design, Australian invoicing, application security and web performance. Relevant primary pages were then fetched and used. Direct Node.js, Supabase and W3C source reads supplemented these results. This is not a claim that every returned search candidate was independently validated.
- Lint and TypeScript passed. All 148 unit tests passed using an equivalent Node test-runner invocation. Migration source checks passed, including 23/23 RLS tables. Production build passed using a temporary host workaround documented below.
- Synthetic calls reproduced the half-payment behavior, draft term reset, and invoice-create payload omissions without contacting a database or writing customer records.

**Limits:** this is a substantive source/workflow review with public-site inspection, not a completed authenticated usability study, WCAG conformance audit, penetration test, financial reconciliation, or production performance benchmark. Source commit versus deployed commit equivalence was not established. No live Supabase rows, deployment configuration, backup history, hosted migration state or real payment balances were inspected. Local browser execution was blocked by the host's socket restrictions; the cloud browser could not reach this workspace's localhost. Existing historical screenshots were not treated as current UI evidence. No mobile, contrast, zoom, screen-reader or PDF visual pass is claimed.

## Outside perspective

The product is organized around its internal records: clients, requests, intake forms, quotes, schedule, job board, invoices and an assistant. That covers the business well but makes an operator translate “we finished this work; bill the customer” into several administrative concepts.

The code already provides global Quick Create, searchable entity selectors, direct invoice creation, a quote-to-invoice shortcut, job completion actions, mobile navigation, labelled icon buttons, status announcements and defensive business scoping. Preserve these useful foundations. The issue is not that every invoice technically requires the entire pipeline. The issue is that the shortest valid route still requires separate customer/property setup and is not clearly presented as the default.

The best target is a fast core with optional detail: customer, work, price, dates, review. Show scheduling, intake, recurring service and quotation links when relevant. Measure time and successful task completion, not just the number of visible screens.

## Highest-priority findings

Priority meanings: P0 = highest-priority financial integrity correction before expanding billing; P1 = high-value reliability/workflow correction; P2 = usability/maintainability improvement. These are delivery priorities, not CVSS security ratings.

### F01 — P0 — “Part paid” invents an amount

**Observed in executable function logic:** a synthetic $200 invoice with no payments produces a $100 bank-transfer payment when “Part paid” is selected. The function chooses half of the total rather than requesting actual receipts. The payment dropdown calls the server action, which reaches this planner. Unit tests currently encode this behavior, so passing tests do not validate its business suitability.

**Evidence:** [src/features/console/data/invoice-lifecycle.ts:203](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/invoice-lifecycle.ts#L203); [src/features/console/data/operations-repository.ts:679](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L679); [tests/unit/invoice-lifecycle.test.ts:164](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/tests/unit/invoice-lifecycle.test.ts#L164).

**Change:** replace status editing with Record payment: amount, received date, method and reference. Derive payment state and balance from actual ledger entries. Do not fabricate receipt amounts, dates or methods. Keep one-click “Record remaining balance” only with the exact amount visible and a clear deliberate action. Add idempotency/concurrency protection and rollback tests.

### F02 — P1 — Outstanding totals do not represent remaining balances

The invoice list sums the full invoice total for open invoices. The UI model/selector does not carry `amount_paid` or `balance_due`, although the database already has those fields. A partially paid $200 invoice with $75 received should contribute $125 to outstanding, not $200. This follows from the source; no production balance was reconciled.

**Evidence:** [src/features/console/views/invoices-view.tsx:209](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/views/invoices-view.tsx#L209); [src/features/console/data/operations-repository.ts:59](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L59); [supabase/migrations/202608050001_initial_fieldcentral_schema.sql:459](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/supabase/migrations/202608050001_initial_fieldcentral_schema.sql#L459).

**Change:** select/map canonical money fields, show paid and balance separately, define refund/void behavior explicitly, and make list, dashboard, document and database totals agree.

### F03 — P1 — Invoices are independent of jobs, but customer/property prerequisites remain

`jobId` and `quoteId` are optional. `clientId` and `propertyId` are required in both the draft contract and form, and the invoice RPC explicitly rejects a missing primary property. There is no inline customer creation inside the invoice form. Client creation additionally requires a phone number, including for a customer who may only need an emailed bill.

**Evidence:** [src/features/console/data/operations-contract.ts:22](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-contract.ts#L22); [src/features/console/dialogs/invoice-form-dialog.tsx:166](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/dialogs/invoice-form-dialog.tsx#L166); [supabase/migrations/202608070002_invoice_service_addresses_and_invoice_rpc.sql:54](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/supabase/migrations/202608070002_invoice_service_addresses_and_invoice_rpc.sql#L54); [src/features/console/data/client-contract.ts:17](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/client-contract.ts#L17).

**Change:** allow find/add customer inside the invoice composer; separate bill-to from optional service-site information. Save a minimal reusable customer atomically with the document. Do not insert fake phone/address values merely to satisfy old constraints.

### F04 — P1 — Quotes and scheduled job creation require requests

The quote draft and schedule contract require `jobRequestId`. The quote form cannot create a quote directly for a client; editing also disables changing its request. Repository creation looks up a request and requires both client and service address. This is a real upstream dependency, not merely a navigation choice.

**Evidence:** [src/features/console/data/operations-contract.ts:13](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-contract.ts#L13); [src/features/console/data/operations-contract.ts:35](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-contract.ts#L35); [src/features/console/data/operations-repository.ts:184](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L184); [src/features/console/dialogs/quote-form-dialog.tsx:135](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/dialogs/quote-form-dialog.tsx#L135).

**Change:** direct quote and direct job entry; requests remain optional intake references. For already-finished work, default to invoice only and offer an optional completed-job record without scheduling fictional work.

### F05 — P1 — Separate invoice scope is accepted but not persisted

The invoice form and Zod contract accept `scope`. The create RPC argument mapper does not pass it; draft update does not write it; loading reconstructs scope from line-item descriptions. A customer-facing scope entered separately cannot survive a live save/load round trip as entered.

**Evidence:** [src/features/console/data/operations-rules.ts:64](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-rules.ts#L64); [src/features/console/data/operations-repository.ts:556](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L556); [src/features/console/data/operations-repository.ts:106](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L106).

**Change:** persist document scope as its own field, map it in both directions, migrate without overwriting existing descriptions, and test reload plus printed output.

### F06 — P1 — Invoice create drops line labels/units

The line-item model and editor support labels and units; `invoiceCreateRpcArgs` serializes only description, quantity and rate. This differs from the update path, which writes `label` and `unit_label`.

**Evidence:** [src/features/console/data/operations-rules.ts:76](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-rules.ts#L76); [src/features/console/data/operations-repository.ts:556](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L556).

**Change:** align create/edit/database/read/print field support and test a 2.5-hour labour line end to end.

### F07 — P1 — Reopening a draft resets payment terms to seven days

`draftInvoiceFromRecord` always returns `dueDays: "7"`. Live update recalculates `due_date` from the original issue date plus that field. Saving an unrelated note on an invoice with 30-day terms can change its due date to seven days.

**Evidence:** [src/features/console/data/quote-invoice.ts:51](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/quote-invoice.ts#L51); [src/features/console/data/operations-repository.ts:594](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L594).

**Change:** use explicit ISO issue/due dates; preserve existing values on edit. Offer preset terms that populate a date rather than silently replacing it.

### F08 — P1 — Document field access is substantially narrower than the printed document

Invoice form: fixed “Upon completion”, fixed 0% tax, editable grace days, client/site, scope, items and notes. No issue date, exact due date, external reference, document-specific terms or discount input. Quote form: request, scope, items, customer/internal notes; no issue/expiry date or validity input. Repository quote creation fixes validity to 14 days; mapper reports 14 days. Terms are module constants; business/payment information is read from the current profile.

**Evidence:** [src/features/console/dialogs/invoice-form-dialog.tsx:269](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/dialogs/invoice-form-dialog.tsx#L269); [src/features/console/dialogs/quote-form-dialog.tsx:1](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/dialogs/quote-form-dialog.tsx#L1); [src/features/console/data/operations-repository.ts:186](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L186); [src/features/console/domain.ts:126](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/domain.ts#L126).

**Change:** implement the field matrix in this kit, especially explicit dates, recipient/billing overrides, terms, references, discounts and supported units. Keep totals computed and invoice numbering controlled. Do not enable arbitrary GST changes until actual registration/tax policy is verified.

### F09 — P1 — Draft updates are not atomic

Invoice update performs header update, item deletion/reinsertion and property-link replacement as separate requests. Quote create/update similarly separates header and line-item writes. An intermediate failure can leave changed headers, missing items or partially completed saves. The invoice create RPC is already a useful atomic precedent, but quote linkage is added afterward.

**Evidence:** [src/features/console/data/operations-repository.ts:187](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L187); [src/features/console/data/operations-repository.ts:556](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L556); [src/features/console/data/operations-repository.ts:540](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L540).

**Change:** transactional database functions for create/update and payment recording, with business authorization, optimistic document version checks, idempotency keys, and injected-failure rollback tests.

### F10 — P1 — Historical documents depend on mutable customer/profile data

Quote/invoice loading looks up current client names and addresses. Document rendering receives the current business profile and payment details. This can make a later reprint differ from what the customer originally received. The reviewed invoice schema has no comprehensive issued-document snapshot.

**Evidence:** [src/features/console/data/operations-repository.ts:106](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L106); [src/features/console/data/operations-repository.ts:101](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L101); [src/features/console/dialogs/document-view-dialog.tsx:58](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/dialogs/document-view-dialog.tsx#L58); [supabase/migrations/202608050001_initial_fieldcentral_schema.sql:437](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/supabase/migrations/202608050001_initial_fieldcentral_schema.sql#L437).

**Change:** snapshot rendered recipient, issuer, payment instructions, terms, items and tax treatment at issue/send/acceptance as appropriate. Preserve an original revision and link corrections. Keep snapshots distinct from editable master customer records.

### F11 — P1 — Edit restrictions need a usable correction path and database enforcement review

App rules permit only draft edits and tell users to void/recreate issued invoices. Draft-only safeguards are valuable, but there is no convenient revise/copy/correct flow. Reviewed invoice/item RLS policies authorize managers by business, while derived-field triggers protect totals, not the complete issued document. Do not assume the UI's draft restriction is a database invariant; test direct Data API changes on staging.

**Evidence:** [src/features/console/data/operations-rules.ts:13](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-rules.ts#L13); [supabase/migrations/202608050001_initial_fieldcentral_schema.sql:1887](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/supabase/migrations/202608050001_initial_fieldcentral_schema.sql#L1887); [supabase/migrations/202608050001_initial_fieldcentral_schema.sql:919](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/supabase/migrations/202608050001_initial_fieldcentral_schema.sql#L919).

**Change:** freely edit drafts; provide revision/correction actions with preserved history for issued documents and accepted quotes. Verify applicable accounting treatment before defining adjustment-note rules. Do not claim every correction legally requires the same action.

### F12 — P1 — AI-tool confirmation is model-supplied

Joseph's chat loop executes tool calls from model arguments. Mutating tools accept `confirm: true` as part of those arguments; a system prompt tells the model when to request confirmation. That is not a server-verifiable record of user approval. Role/tenant checks remain useful but answer a different question.

**Evidence:** [src/features/console/data/joseph-actions.ts:102](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/joseph-actions.ts#L102); [src/features/console/data/joseph-tools.ts:21](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/joseph-tools.ts#L21); [src/features/console/data/joseph-tools.ts:340](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/joseph-tools.ts#L340).

**Change:** model proposes a typed action; UI shows exact target and effect; server issues a short-lived single-use confirmation token bound to actor, tenant, payload hash and version. Execute only the confirmed operation. Continue blocking technician financial writes. No exploit was attempted and no model call was made in this review.

## Navigation, interaction and accessibility

### F13 — P1 — Main navigation is in React state, without durable route state

`ConsoleApp` initializes `active` to dashboard and switches views in local state. There is a demo-only document-preview query mechanism, but no general route/history synchronization in the reviewed shell. Refresh, sharing a record and Back/Forward therefore need first-class support.

**Evidence:** [src/features/console/console-app.tsx:243](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/console-app.tsx#L243).

**Change:** stable URLs for main views and record details, restorable filters, semantic links, correct page titles/focus on navigation, and preserved unsaved drafts. Introduce incrementally; no full rewrite is required.

### F14 — P2 — Too many equal-weight destinations and billing actions

Ten sidebar destinations span several workflow concepts. Invoices combine payment dropdown, view, edit, mark paid, issue, mark sent, void and delete according to state. Useful shortcuts exist, but the hierarchy is difficult to learn from the labels alone. “New Invoice” Quick Create describes billing a job/quote even though it can start blank.

**Evidence:** [src/features/console/components/sidebar.tsx:27](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/components/sidebar.tsx#L27); [src/features/console/components/top-command-bar.tsx:456](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/components/top-command-bar.tsx#L456); [src/features/console/views/invoices-view.tsx:34](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/views/invoices-view.tsx#L34).

**Change:** recommend Home, Work, Customers, Billing, More at the top level; keep Invoices and Quotes obvious inside Billing and available through persistent Create actions. Validate this grouping with operators before removing existing access. One clear primary action per record state; less common safe actions in a labelled overflow menu.

### F15 — P1 — Unsaved document work can be discarded

Shared dialog closes on backdrop, Escape or close control; there is no shared dirty-state check. Quote/invoice forms keep draft text in local component state. On-close behavior does not distinguish clean versus edited forms.

**Evidence:** [src/features/console/components/dialog.tsx:32](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/components/dialog.tsx#L32); [src/features/console/components/dialog.tsx:79](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/components/dialog.tsx#L79).

**Change:** autosave recoverable drafts or a discard guard for changed content; safe closing during pending mutations; an obvious saved/saving/retry state. Do not add confirmation to every ordinary save.

### F16 — P1 — Dialog focus handling has edge cases

Dialog role, accessible title, initial focus and a focus trap exist. However, its focusable selector includes disabled/hidden controls, uses a shared title ID and does not make the background inert. The effect depends on `onClose`; changing callback identity can repeatedly clean up/reinitialize focus while the dialog remains open. These are code-level risks pending browser/screen-reader reproduction.

**Evidence:** [src/features/console/components/dialog.tsx:39](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/components/dialog.tsx#L39); [src/features/console/components/dialog.tsx:74](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/components/dialog.tsx#L74).

**Change:** robust native or tested modal primitive, unique IDs, genuinely tabbable controls, inert background, stable effect lifecycle, focus restoration after success/error. Test long forms and pending states in both keyboard directions.

### F17 — P1 — Generic Field wrapper can contain multiple labelable controls

`Field` renders a wrapping `<label>`. `EntityPicker` puts both a search input and select inside it once there are more than eight options. The filter has an explicit name; the select does not have its own explicit ID/label relationship in that branch. Do not treat this as a proven screen-reader failure without runtime inspection, but the markup should be corrected.

**Evidence:** [src/features/console/components/ui-elements.tsx:219](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/components/ui-elements.tsx#L219); [src/features/console/components/entity-picker.tsx:51](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/components/entity-picker.tsx#L51).

**Change:** one explicit label per control; shared group/legend and programmatically associated hints/errors. Preserve native select usability or implement a fully tested combobox.

### F18 — P1 — Financial form failure paths need better recovery

Zod failures become “Check the details and try again.” Some client checks return silently. `persistQuote` and `persistInvoice` await live callbacks without the network exception handling used in several other mutation paths. An unexpected transport failure can leave pending state uncleared. Input errors should identify the field and preserve all entries.

**Evidence:** [src/features/console/data/operations-actions.ts:44](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-actions.ts#L44); [src/features/console/console-app.tsx:985](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/console-app.tsx#L985); [src/features/console/console-app.tsx:1056](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/console-app.tsx#L1056).

**Change:** typed field errors, error summary linked to fields, `aria-invalid`/`aria-describedby`, focus to first error, and `try/catch/finally` with retry-safe writes.

### F19 — P2 — Visual accessibility still needs measured testing

The CSS contains very small secondary text, several layers of phone overrides, custom focus styling and reduced-motion support in some stylesheets. Small text alone is not a WCAG failure. No contrast ratio, touch-target failure, overflow result or score is claimed.

**Evidence:** [src/features/console/console.css:1](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/console.css#L1); [src/features/console/console-phone.css:1](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/console-phone.css#L1).

**Change:** test WCAG 2.2 AA across actual desktop/mobile states; 4.5:1 normal text, 3:1 large text and relevant UI boundaries, visible/unobscured focus, keyboard operation, 200% text resize, 320 CSS-pixel reflow, and target-size/spacing requirements. Use 44px comfortable targets as a product preference; WCAG 2.2 AA 2.5.8 generally uses 24px with exceptions. Add a skip link. Check sticky bars and on-screen keyboard overlap. Existing job actions mean it would be inaccurate to call the board entirely drag-only; verify every status operation has a keyboard alternative.

## Engineering and operational readiness

### F20 — P1 — Existing checks do not cover the critical live guarantees

The repository has CI, 148 passing unit tests and migration-text checks. Browser specs mostly exercise demo/empty states; one lifecycle test conditionally skips its assertions if an Issue button is not visible. There is no supplied live two-tenant integration result. Demo quote creation hardcodes a customer/address/dates, further limiting its value as evidence for real document round trips.

**Evidence:** [tests/e2e/demo-console.spec.ts:79](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/tests/e2e/demo-console.spec.ts#L79); [src/features/console/console-app.tsx:1007](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/console-app.tsx#L1007); [scripts/verify-migrations.mjs:1](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/scripts/verify-migrations.mjs#L1); [.github/workflows/ci.yml:1](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/.github/workflows/ci.yml#L1).

**Change:** deterministic synthetic fixtures, guaranteed assertions, database integration tests, role/tenant denial tests, transaction rollback/concurrency, non-default document reload tests and PDF verification. Continue using unit tests, but change tests that encode invented business behavior.

### F21 — P1 — CI uses an end-of-life Node major

The CI workflow specifies Node 20. The official Node release table lists Node 20 as EOL and Node 24 as LTS on the review date. The review's successful build and unit run used Node 24.22.1; this is useful compatibility evidence but not a full deployment-runtime validation.

**Evidence:** [.github/workflows/ci.yml:16](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/.github/workflows/ci.yml#L16); [Node release status](https://nodejs.org/en/about/previous-releases).

**Change:** dedicated runtime alignment PR: use supported Node 24 LTS for development, CI and Vercel, pin an agreed patch in the actual environment, run checks/browser tests, then record the result. Do not silently edit deployment settings from this review.

### F22 — P2 — Documentation and package-manager drift

Both npm and pnpm lockfiles exist, while README, scripts and CI use npm. README says to apply “both migrations” although the repository contains ten SQL migrations. This can mislead a new maintainer about deployment readiness.

**Evidence:** [README.md:38](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/README.md#L38); [package.json:1](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/package.json#L1); [.github/workflows/ci.yml:1](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/.github/workflows/ci.yml#L1).

**Change:** use npm and `package-lock.json` for the takeover; verify actual hosted migration history. Retire an alternate lockfile only in a reviewed housekeeping change; document ordered migrations and environment setup accurately.

### F23 — P2 — Initial data loading will become expensive as history grows

Home eagerly loads ten data slices. Operation lists load all matching records/items and repeated lookup maps; jobs sign attachment URLs for the loaded set. No list pagination was found in these paths. This is an architectural scaling risk, not a measured performance regression.

**Evidence:** [src/app/page.tsx:54](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/app/page.tsx#L54); [src/features/console/data/operations-repository.ts:146](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/src/features/console/data/operations-repository.ts#L146).

**Change:** measure first; add bounded pagination, shared lookups and route-specific loading where useful. Track field Core Web Vitals at the 75th percentile, split mobile/desktop. Do not use dev-mode timings as production evidence.

### F24 — P2 — PWA installability does not mean offline operations work

The service worker caches branding/icons and uses network access for normal requests. It does not implement a durable offline work or invoice mutation queue.

**Evidence:** [public/sw.js:1](https://github.com/afrench454-alta/MG-Webapp/blob/50cf2ae9b7b0db4efdf513f600f0f73786a2f88d/public/sw.js#L1).

**Change:** communicate offline status and preserve unsent drafts. If field connectivity is a real problem, implement a separate explicit conflict-safe sync feature. Do not promise offline billing based on installation support alone.

## Proposed improvement strategy

| Approach | Benefit | Cost/risk | Recommendation |
|---|---|---|---|
| Only add shortcuts to the existing stages | Small initial change | Leaves separate customer/property setup, rigid quotes, missing fields and data bugs | Useful temporary relief, insufficient as final solution |
| Direct-task workflows on the current stack | Fast invoicing plus optional operational detail; preserves working code/data | Requires contract/RPC changes, fixtures and careful rollout | Recommended |
| Full rewrite or replacement platform | Maximum freedom | Migration, training, regression and delivery risk | No evidence justifies this now |

This recommendation is a proposal for subsequent implementation, not an approved design or permission to alter production.

Suggested default actions: Create invoice; Create quote; Add job; Add customer. From a finished visit: Invoice this work. Preserve “record paid” as a separate, evidence-based action. Invoice creation should not silently mark a job completed, spawn recurrence or send a document.

Suggested normal job view: To do, In progress, Done. Scheduling is an attribute; Hold and Cancel remain available. Keep current database statuses and historical reports initially; introduce simpler views and direct transitions before considering migration. Invoice document, delivery and payment state remain distinct even if the UI summarizes them.

## Standards used and acceptance targets

| Source | How it applies | Current assessment |
|---|---|---|
| W3C WCAG 2.2 AA and ARIA APG | Keyboard, focus, labels, errors, reflow, target size, financial error prevention | Several source-level risks identified; rendered/manual audit pending |
| GOV.UK form-structure guidance | Justify each requested field, branch irrelevant questions, combine repetitive internal tasks when research supports it | Required upstream records/phone/property create avoidable burden |
| ATO invoice guidance | Correct invoice label and required tax information for the actual registration/supply scenario | Code asserts non-GST registration; actual business status unverified |
| OWASP ASVS | Authorization, record integrity and transaction testing | Good scoping patterns present; no conformance claim; staging checks required |
| Supabase RLS guidance | Explicit grants/policies and allow/deny database tests | Source checks pass; live tenant/role and immutable-document checks pending |
| web.dev Core Web Vitals | LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at p75 | Targets only; no production measurements collected |
| OpenAI current product docs | Durable AGENTS.md, configured coding environment, project context | Setup supplied; no account/environment changes made |

The module's “not registered for GST” text is an application assumption, not proof of current registration. ATO distinguishes ordinary invoices from tax invoices; do not default to a GST/tax-invoice design just because another software package uses one. Recheck registration and the tax treatment of supplies before adding tax settings. See SOURCES.md for direct primary links.

## Verification record

| Check | Result | Qualification |
|---|---|---|
| `npm ci` | Passed | Locked dependency install |
| `npm run lint` | Passed | Ran as part of initial check |
| `npm run typecheck` | Passed | Ran as part of initial check |
| `npm run check` as written | Blocked in unit step | `tsx` CLI IPC socket EPERM on review host; composite command did not complete |
| `node --import tsx --test tests/unit/*.test.ts` | 148 passed, 0 failed | Equivalent test files, avoids CLI IPC; no product changes |
| `npm run check:migrations` | Passed | Text/invariant checks; not proof migrations are deployed |
| `npm run build` | Passed with host workaround | `os.networkInterfaces()` throws here; temporary preload returns empty interfaces on that error. No repo config was edited. Build validates source under that workaround, not unmodified-host portability |
| Three synthetic function reproductions | Confirmed | No DB connection, no real records |
| Playwright / axe / mobile interaction checks | Blocked, not passed | Browser binary download failed; system Chromium launch blocked by socket restrictions; remote browser localhost refused |
| `npm audit --audit-level=moderate` | No usable result during review | Registry request did not return a report; no claim of zero vulnerabilities |
| Live authenticated flows and PDF visual QA | Not run | Staging/test access needed |
| Git working tree | Clean after review | No product source changes |

A supported browser environment and isolated Supabase test instance are the concrete remaining prerequisites for the full interaction/integration pass. The first Codex tasks should complete those checks and update this evidence rather than repeat this report as an established production audit.
