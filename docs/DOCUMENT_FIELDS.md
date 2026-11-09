# Invoice and quote field/editing contract

Status: proposed requirements. Every exposed field must pass create → save → reload → edit → preview → PDF checks. Update TypeScript types, Zod schema, action payload, transaction/RPC, SQL, row mapper and renderer together. A field that only changes local state is unfinished.

| Field | Draft behavior | After issue/acceptance | Current gap/decision |
|---|---|---|---|
| Customer identity | Search/add inline; correct recipient | Preserve snapshot; correction workflow | Existing customer required; inline add absent |
| Contact email/name | Optional except chosen delivery requirement | Snapshot actual recipient at delivery/issue | No full document-specific recipient controls |
| Phone | Optional unless task actually needs it | Snapshot only if shown | Client schema currently requires it |
| Billing name/address | Document override separate from customer master | Original preserved | Service property currently required/used for billing |
| Service site(s) | Optional separate link/address; multiple if useful | Preserve rendered sites | Existing primary property mandatory |
| Document number | Generated; optional safe draft/custom reference policy | Immutable unique final ID | Do not allow arbitrary issued-number edits |
| Customer/PO/reference | Editable optional | Audited correction if printed | Add explicit external reference support |
| Issue date | Explicit date, business-local default | Controlled correction | Not exposed in current form |
| Invoice due date | Exact date plus terms presets | Controlled correction, no silent reset | Reopen currently defaults seven days |
| Quote valid-until | Exact date/preset validity | Revision if commercial terms change | Fixed fourteen days in repository/mapping |
| Service date/period | Optional when relevant | Snapshot | Separate from issue date |
| Scope of work | Editable text separate from prices | Snapshot/revision | Invoice scope currently omitted from persistence |
| Line description | Editable | Snapshot/revision | Already exposed |
| Quantity | Positive decimal supported | Recalculate only in correction | Already exposed; verify rounding |
| Unit label / line label | Editable supported units | Snapshot | Invoice create drops these |
| Unit price | Nonnegative decimal under documented rules | Revision/credit policy | Already exposed; never manually override derived total |
| Discount | Fixed amount or percent with explicit type, bounds, order | Revision/correction | Not exposed; choose implementation before adding |
| GST/tax treatment | Config-driven for actual registration and supply | Snapshot rules/rate | Code assumes non-GST; verify current registration first |
| Customer-visible notes | Editable | Snapshot; auditable corrections | Currently payment_instructions conflates invoice notes |
| Internal notes | Editable separately; never printed | Can remain internal/audited | Keep separate from customer notes; avoid fallback leakage |
| Document-specific terms | Editable with business defaults | Snapshot/version | Current terms are module constants |
| Payment instructions | Business default + audited document override if needed | Preserve instructions actually issued | Current renderer reads latest profile bank details |
| Logo/issuer identity/ABN | Business configuration plus document snapshot | Preserve original | Current renderer uses current profile |
| Subtotal/tax/total | Computed and persisted consistently | Immutable original | Do not provide arbitrary total input |
| Amount received/balance | Derived from payment/refund ledger | Derived with audit trail | DB has fields but invoice selector/model omit them |
| Payment event | Actual amount/date/method/reference | Correct via reversal/linked entry | Remove status-based invented amount |
| Job/request/quote links | Optional, choose/relink with validation | Audited, preserve lineage | Quote/job creation currently request-bound |
| Delivery state | Explicit recorded send or mark-as-sent | Audit actual recipient/time/result | Do not imply mark-sent actually emailed |

## Important implementation details

Store dates as ISO calendar dates and format for en-AU at the boundary; use Australia/Brisbane for business-day defaults. Do not parse rendered date strings to reconstruct canonical dates. Keep money in database numeric or a consistent minor-unit/decimal approach, document rounding and calculate identical totals in all surfaces. Do not independently recalculate a list amount using different discount/tax arguments.

A business not registered for GST should issue an ordinary invoice, not a tax invoice. When GST registration is enabled after verification, derive applicable tax-invoice requirements from ATO guidance and support taxable/non-taxable lines as needed. No arbitrary editable tax rate should override registration policy. Terms text asserting non-registration must agree with actual settings and document snapshot.

Issued-document corrections require preserving the original, reason, author, timestamp, link and relevant payment balance. Define when a replacement, revision, credit/adjustment or refund is appropriate before implementation; this kit does not declare a universal legal correction rule.
