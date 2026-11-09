# Workflow proposal — direct work, optional detail

Status: recommended design direction from review, not yet implemented or approved by the business. Preserve the current stack and data; validate the detailed UI before a broad change.

## Paths that must exist

| Operator intent | Proposed path | Records that are optional |
|---|---|---|
| Bill work already done, existing customer | Create invoice → find customer → work/items/dates → review/issue | Request, questionnaire, quote, job, schedule |
| Bill work already done, new customer | Same composer → Add customer inline → enter minimum identity/contact needed → continue | Same; do not require returning through customer directory |
| Quote a customer | Create quote → find/add customer → scope/items/validity → save or review/send | Request, questionnaire, job, schedule |
| Record work already finished | Create invoice with optional “Also record completed job” | Scheduling and all prior job stages |
| Plan future work | Add job → customer/site → optional date/crew/recurrence | Request and quote |
| Invoice an accepted quote | Quote → Create invoice → editable prefill → review/issue | Job/scheduling |
| Invoice an existing finished job | Job → Invoice this work → editable prefill → review/issue | Separate request/quote creation |

Do not create hidden fake requests, phantom scheduled visits, placeholder phone numbers or fabricated property records to make the UI appear shorter. Optional internal links must be honest and nullable where appropriate. Reuse the same composer/transaction rules for blank, customer, quote and job entry points.

## Invoice composer

Customer at top with search and inline Add. Main fields: bill-to, description/line items, service date if relevant, issue date, due date/terms. Clearly visible total. Expand More details for service site, scope, references, discounts, document notes, internal notes and terms. Defaults come from business/customer settings but existing document values win when editing.

Save draft permits incomplete optional metadata; final issue validates the fields actually required for the business/supply. Make “Save draft” and “Review & issue” explicit. A preview inside the workflow permits correction before issue, without forcing extra navigation. Sending, recording payment, scheduling and job completion do not happen implicitly. “Mark sent” remains a record of external delivery until an actual sender exists.

Inline customer can start with name/identity and the contact required for the chosen delivery method. Name is a proposed product requirement; exact legal invoice requirements depend on registration/supply. Email is required only if sending by email; phone is not a default blocker for creating a draft/PDF. Separate service location from billing recipient. Address optionality requires coordinated schema/RPC changes.

## Document state

Drafts: editable. Issued/sent invoices: preserve original snapshot, offer a correction/revision action that explains its effect and creates linked history. Paid invoices: prevent casual re-pricing; use explicit credit/refund/correction flow. Accepted quotes: revision without destroying acceptance evidence. Do not universally equate “edit” with “void”; define correction treatment with the owner/accounting rules before shipping.

Financial state derives from recorded transactions. Delivery state reflects a real send or an explicit mark-as-sent. Dates/statuses remain accurate when the UI combines actions. Add idempotency keys, document versions and server-side expected-state checks for issue/pay/edit races.

## Jobs and navigation

Proposed normal board labels: To do, In progress, Done. Scheduled date, assignment, recurrence, hold and cancellation remain facts/actions. Start and complete directly without a compulsory tour of every state. Initially map simple views onto existing statuses; avoid destructive status migrations. Completing recurring work must spawn at most one next visit.

Proposed top-level navigation: Home, Work, Customers, Billing, More. Work contains jobs/calendar and optional requests; Billing has obvious Invoices and Quotes tabs. More contains forms/settings/assistant as usage warrants. Owner quick-create keeps Invoice and Quote prominent; technician landing emphasizes today's assigned work. Validate with owner/co-owner before removing a useful current shortcut.

## Success measures

Targets to validate, not baseline measurements: draft an invoice for an existing customer in ≤60 seconds, a new customer in ≤90 seconds for a simple one-line scenario; no forced exits to another module; no artificial upstream record; no irrelevant required field; zero lost input on recoverable failure; all critical tasks possible using keyboard and at 320px width.

Measure completion rate, time, meaningful interactions, validation errors and operator feedback using synthetic scenarios and minimal privacy-safe telemetry. Do not optimize by dropping review, permissions or financial accuracy.
