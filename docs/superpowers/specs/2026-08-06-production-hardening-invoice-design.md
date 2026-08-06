# Production Hardening and Multi-Address Invoice Design

## Goal

Harden the current Mow & Glow operations app for small-business production use by closing the most immediate financial and security gaps while adding support for invoices that reference more than one client property.

## Approved Scope

This spec covers five focused changes:

1. Multi-address invoices
2. Atomic invoice creation
3. Draft-only invoice deletion with void support for finalized invoices
4. Browser security headers in Next.js
5. Safer job deletion rules

It does not attempt a full accounting ledger, advanced audit logging redesign, or a broad questionnaire rebuild.

## Current State

The app already uses Supabase for core operational data and has RLS across the current exposed tables. The main production risks found in the current code are:

- invoices currently store only one `billing_address_id`
- invoice creation writes the invoice row first and line items second, so partial saves are possible if the second insert fails
- invoices can be hard-deleted regardless of status
- job deletion is available without enough server-side safety checks
- the Next.js app does not currently emit baseline browser security headers

The invoice PDF is the browser print view from the same React document component, so invoice address changes must be reflected in the shared data model and UI rather than added as a print-only workaround.

## Design

### 1. Multi-address invoices

Invoices will keep one primary billing address for compatibility with the existing `invoices.billing_address_id` column and current downstream mappings. Additional service properties will be stored in a new join table linked to the invoice.

Database shape:

- keep `invoices.billing_address_id` as the primary display and legacy billing address
- add `invoice_service_addresses`
  - `invoice_id uuid not null`
  - `business_id uuid not null`
  - `client_address_id uuid not null`
  - `position smallint not null default 0`
  - `created_at timestamptz not null default now()`
  - primary key on `(invoice_id, client_address_id)`

Rules:

- every selected invoice property must belong to the same business and client as the invoice
- at least one property must be selected
- the first selected property becomes the primary billing address unless an explicit primary selection is added later
- the document view will show all selected service addresses in a dedicated address block

This keeps the existing invoice record usable while allowing a second property address immediately and more than two later without another schema change.

### 2. Atomic invoice creation

Invoice creation will move from separate client-side table inserts to one database RPC that validates the target client and properties, inserts the invoice, inserts selected service addresses, inserts line items, and returns the new invoice id.

Why this approach:

- removes partial invoice saves
- centralizes validation in one place
- reduces client-side data write orchestration
- fits the existing Supabase-backed server action pattern

The RPC will be the only write path used by `saveInvoiceAction`.

### 3. Financial record protection

Deletion and status behavior will change as follows:

- draft invoices may still be deleted
- issued/finalized/void invoices may not be deleted
- finalized invoices can be marked `Void`
- payment-status updates must not silently revive voided invoices

This preserves practical cleanup for mistakes during draft preparation without allowing finalized financial records to disappear.

### 4. Safer job deletion

Job deletion will stay available but will be blocked once the job has operational history that makes deletion unsafe.

Deletion is allowed only when the job:

- is still in a schedulable state
- has no uploaded photos
- has no completion or progress notes persisted to the job record

If those checks fail, the delete action returns a clear server error and the UI shows that the job must be cancelled or edited instead of deleted.

### 5. Browser security headers

The Next.js app will emit baseline response headers through `next.config.ts`.

Headers:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy`
- `Permissions-Policy`

The CSP will be conservative enough to avoid breaking local Next.js development and Supabase browser requests. HSTS is intentionally excluded here because it belongs on the HTTPS production host, not a local or preview app process.

## File and Component Impact

### Database and Supabase

- `supabase/migrations/*` for the new table, policies, validation function, and invoice creation RPC
- `supabase/README.md` if setup guidance needs one more migration note

### Invoice contracts and repository

- `src/features/console/data/operations-contract.ts`
  - accept multiple property ids for invoices
- `src/features/console/data/operations-repository.ts`
  - read service addresses
  - map multi-address invoice display data
  - call the new RPC for creation
  - block unsafe invoice deletion
  - protect void/payment transitions

### Invoice UI and PDF view

- `src/features/console/console-app.tsx`
  - invoice form: multi-property selection
  - invoice document view: render all selected addresses
  - delete button rules and error messages
- `src/features/console/console.css`
  - layout for the additional invoice address block in both app and print views

### App security

- `next.config.ts`
  - add response headers with environment-aware CSP values

## Data Flow

Invoice creation flow after this change:

1. User selects client, one or more properties, due days, and line items.
2. Server action validates the payload.
3. Repository calls a single Supabase RPC.
4. RPC verifies business/client/property relationships and inserts all invoice records in one transaction.
5. Repository reloads the created invoice through the standard query path.
6. UI updates list and document preview using the normalized invoice shape.

## Error Handling

- invalid property combinations return a server validation error
- empty line-item lists remain rejected by the current validation layer
- draft delete attempts on missing invoices return the existing not-found style error
- delete attempts for non-draft invoices return a specific message explaining that the invoice must be voided instead
- unsafe job delete attempts return a specific message explaining why deletion is blocked

## Testing Strategy

The implementation will follow TDD where practical in the current repo setup.

Minimum verification coverage:

- server-side validation test or repository-level regression coverage for multi-property invoice input
- regression coverage for invoice mapping to document view with multiple addresses
- regression coverage for blocked deletion of finalized invoices
- regression coverage for blocked deletion of jobs with attachments/history
- fresh `npm run check`
- fresh `npm run build`

Supabase verification must include:

- migration list sanity check
- schema advisor or equivalent verification if available
- a direct verification path that proves the new invoice write path and address relation work

## Security Notes

- no service-role credentials will be introduced to browser code
- any new exposed table will have RLS enabled
- validation code that needs elevated access will be tightly scoped and reviewed for `security definer` risks
- the new invoice relation table will be bound to the existing business isolation model

## Success Criteria

The work is complete when all of the following are true:

- an invoice can include two client properties and both appear in the in-app document and print/PDF view
- invoice creation is atomic and no partial invoice header can remain if related inserts fail
- finalized invoices cannot be hard-deleted
- draft invoices can still be deleted
- jobs with operational history cannot be hard-deleted
- baseline security headers are present on app responses
- checks and build pass on a fresh run
