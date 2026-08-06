# Production Hardening and Multi-Address Invoice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-address invoice support, harden invoice and job deletion behavior, and ship baseline browser security headers without regressing the current Supabase-backed console workflow.

**Architecture:** The change keeps the current App Router and Supabase server-action structure, but moves invoice creation into a transactional database RPC and extends the invoice read model with a service-address relation. UI work stays inside the existing console feature, while security hardening is isolated to `next.config.ts`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Zod, ESLint, Node scripts

## Global Constraints

- Keep the existing Supabase business isolation model intact.
- Do not introduce any browser exposure of service-role credentials.
- Keep `invoices.billing_address_id` for compatibility and use a relation table for additional addresses.
- Finalized or void invoices must not be hard-deletable.
- Jobs with persisted operational history must not be hard-deletable.
- The invoice print/PDF view must render the same multi-address data as the in-app document view.
- Verification must include fresh `npm run check` and fresh `npm run build`.

---

### Task 1: Add the Supabase invoice-address schema and transactional invoice RPC

**Files:**
- Create: `supabase/migrations/<generated>_invoice_service_addresses_and_invoice_rpc.sql`
- Modify: `supabase/README.md`
- Test: manual SQL verification against linked/local Supabase plus `npm run check`

**Interfaces:**
- Consumes: existing `invoices`, `invoice_line_items`, `client_addresses`, and business helper functions from current migrations
- Produces: `public.invoice_service_addresses` table and one RPC callable from the app, recommended signature:
  - `public.create_invoice_with_details(target_client_id uuid, primary_address_id uuid, service_address_ids uuid[], target_job_id uuid, due_days integer, invoice_notes text, invoice_items jsonb) returns uuid`

- [ ] **Step 1: Write the failing verification target**

```sql
-- Expected failing behavior before implementation:
-- This relation table and RPC do not exist yet.
select to_regclass('public.invoice_service_addresses');
select public.create_invoice_with_details(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  array['00000000-0000-0000-0000-000000000000']::uuid[],
  null,
  7,
  null,
  '[]'::jsonb
);
```

- [ ] **Step 2: Verify the red state**

Run: `npx supabase migration list`
Expected: current migrations only; no new invoice-address migration exists yet

- [ ] **Step 3: Generate the migration shell**

```bash
npx supabase --help
npx supabase migration new invoice_service_addresses_and_invoice_rpc
```

- [ ] **Step 4: Write the minimal schema and RPC**

```sql
create table public.invoice_service_addresses (
  business_id uuid not null references public.businesses (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  client_address_id uuid not null references public.client_addresses (id) on delete restrict,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  primary key (invoice_id, client_address_id)
);

alter table public.invoice_service_addresses enable row level security;

create policy "Managers can read invoice service addresses"
on public.invoice_service_addresses
for select
to authenticated
using (public.is_business_manager(business_id));

create policy "Managers can manage invoice service addresses"
on public.invoice_service_addresses
for all
to authenticated
using (public.is_business_manager(business_id))
with check (public.is_business_manager(business_id));
```

- [ ] **Step 5: Add validation and the transactional RPC**

```sql
create or replace function private.assert_invoice_service_addresses(
  target_business_id uuid,
  target_client_id uuid,
  requested_address_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  matched_count integer;
begin
  if array_length(requested_address_ids, 1) is null then
    raise exception 'At least one property address is required.';
  end if;

  select count(*)
  into matched_count
  from public.client_addresses
  where business_id = target_business_id
    and client_id = target_client_id
    and id = any(requested_address_ids);

  if matched_count <> array_length(requested_address_ids, 1) then
    raise exception 'One or more invoice property addresses are invalid.';
  end if;
end;
$$;
```

- [ ] **Step 6: Verify the migration definition**

Run: `npx supabase migration list`
Expected: the new migration appears after `202608070001_operational_workflows`

- [ ] **Step 7: Run Supabase safety checks**

Run: `npx supabase db lint --linked --level warning`
Expected: no new schema warnings

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations supabase/README.md
git commit -m "feat: add transactional invoice creation schema"
```

### Task 2: Extend invoice contracts and repository mapping for multi-address invoices

**Files:**
- Modify: `src/features/console/data/operations-contract.ts`
- Modify: `src/features/console/data/operations-repository.ts`
- Modify: `src/features/console/domain.ts`
- Test: `src/features/console/data/operations-repository.test.ts`

**Interfaces:**
- Consumes: new RPC from Task 1 plus existing lookup maps and invoice list flows
- Produces:
  - `InvoiceDraftInput.propertyIds: string[]`
  - repository support for `serviceAddresses: string[]`
  - `createInvoice(context, input): Promise<Invoice>`

- [ ] **Step 1: Write the failing repository tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { mapInvoiceForTest } from "./operations-repository";

test("maps multiple invoice service addresses into document data", () => {
  const invoice = mapInvoiceForTest({
    billingAddress: "21 Parkside Dr",
    serviceAddresses: ["21 Parkside Dr", "4 D'Aguilar Hwy"],
  });

  assert.deepEqual(invoice.serviceAddresses, [
    "21 Parkside Dr",
    "4 D'Aguilar Hwy",
  ]);
});

test("rejects invoice draft payloads without at least one property id", () => {
  assert.throws(() => invoiceDraftSchema.parse({
    clientId: "11111111-1111-1111-1111-111111111111",
    propertyIds: [],
    dueDays: 7,
    notes: "",
    items: [{ description: "Mow", quantity: 1, rate: 50 }],
  }));
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test src/features/console/data/operations-repository.test.ts`
Expected: FAIL because the helper/schema does not yet support `serviceAddresses` and `propertyIds`

- [ ] **Step 3: Update the invoice contract minimally**

```ts
export const invoiceDraftSchema = z.object({
  clientId: z.uuid(),
  propertyIds: z.array(z.uuid()).min(1, "At least one property is required."),
  jobId: z.uuid().optional().nullable(),
  dueDays: z.number().int().min(0),
  notes: z.string(),
  items: z.array(itemSchema).min(1),
});
```

- [ ] **Step 4: Implement repository support**

```ts
type InvoiceAddressRow = {
  invoice_id: string;
  client_address_id: string;
  position: number;
};

type InvoiceWithServiceAddresses = Invoice & {
  serviceAddresses: string[];
};

const { data, error } = await supabase.rpc("create_invoice_with_details", {
  target_client_id: input.clientId,
  primary_address_id: input.propertyIds[0],
  service_address_ids: input.propertyIds,
  target_job_id: input.jobId ?? null,
  due_days: input.dueDays,
  invoice_notes: input.notes || null,
  invoice_items: input.items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
  })),
});
```

- [ ] **Step 5: Expose a stable mapping shape to the UI**

```ts
return {
  id: row.id,
  documentNumber: row.document_number || undefined,
  client: lookups.clients.get(row.client_id) || "Client",
  address: primaryAddress || "No billing address",
  serviceAddresses,
  issued: formatDate(row.issue_date),
  due: formatDate(row.due_date),
  documentStatus: mapInvoiceDocumentStatus(row.document_status),
  paymentStatus: mapInvoicePaymentStatus(row.payment_status),
  scope: items.map((item) => item.description),
  notes: row.payment_instructions || row.internal_notes || "",
  discount: 0,
  taxRate: 0,
  items: items.map((item) => ({ description: item.description, quantity: item.quantity, rate: item.unit_price })),
};
```

- [ ] **Step 6: Run the focused repository test**

Run: `node --test src/features/console/data/operations-repository.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/console/data/operations-contract.ts src/features/console/data/operations-repository.ts src/features/console/domain.ts src/features/console/data/operations-repository.test.ts
git commit -m "feat: support multi-address invoice data"
```

### Task 3: Update invoice UI, PDF rendering, and destructive-action rules

**Files:**
- Modify: `src/features/console/console-app.tsx`
- Modify: `src/features/console/console.css`
- Modify: `src/features/console/data/operations-actions.ts`
- Modify: `src/features/console/data/operations-repository.ts`
- Test: `src/features/console/console-app.test.tsx` or `src/features/console/console-view-model.test.ts`

**Interfaces:**
- Consumes: `Invoice.serviceAddresses`, `InvoiceDraftInput.propertyIds`, repository delete guards
- Produces:
  - invoice form multi-property selection
  - document view address list rendering
  - invoice delete guarded to drafts
  - job delete guarded by persisted history

- [ ] **Step 1: Write the failing UI and behavior tests**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { getVisibleInvoiceAddresses, canDeleteInvoice } from "./console-view-model";

test("shows all invoice service addresses in order", () => {
  assert.deepEqual(
    getVisibleInvoiceAddresses({
      address: "21 Parkside Dr",
      serviceAddresses: ["21 Parkside Dr", "4 D'Aguilar Hwy"],
    }),
    ["21 Parkside Dr", "4 D'Aguilar Hwy"],
  );
});

test("blocks delete for finalized invoices", () => {
  assert.equal(canDeleteInvoice({ documentStatus: "Finalized" }), false);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `node --test src/features/console/console-view-model.test.ts`
Expected: FAIL because the helpers and delete rules do not yet exist

- [ ] **Step 3: Implement the minimal UI changes**

```tsx
<fieldset className="property-checklist">
  {clientProperties.map((property) => (
    <label key={property.id} className="checkbox-row">
      <input
        type="checkbox"
        checked={draft.propertyIds.includes(property.id)}
        onChange={() => toggleProperty(property.id)}
      />
      <span>{property.label}</span>
    </label>
  ))}
</fieldset>
```

- [ ] **Step 4: Render all addresses in the document and print view**

```tsx
<div className="document-addresses">
  {invoiceAddresses.map((line) => (
    <address key={line}>{line}</address>
  ))}
</div>
```

- [ ] **Step 5: Implement server-side delete guards**

```ts
export async function deleteInvoice(context: BusinessContext, id: string): Promise<string> {
  const invoice = await getInvoice(context, id);
  if (invoice.documentStatus !== "Draft") {
    throw new Error("Only draft invoices can be deleted. Void finalized invoices instead.");
  }
  // existing delete call
}
```

- [ ] **Step 6: Implement job deletion safety checks**

```ts
const hasUnsafeHistory =
  Boolean(job.notes?.trim()) ||
  attachments.length > 0 ||
  job.status === "In progress" ||
  job.status === "Completed";

if (hasUnsafeHistory) {
  throw new Error("This job has history and can no longer be deleted.");
}
```

- [ ] **Step 7: Run the focused tests**

Run: `node --test src/features/console/console-view-model.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/features/console/console-app.tsx src/features/console/console.css src/features/console/data/operations-actions.ts src/features/console/data/operations-repository.ts src/features/console/console-view-model.test.ts
git commit -m "feat: harden invoice and job destructive actions"
```

### Task 4: Add browser security headers and finish full verification

**Files:**
- Modify: `next.config.ts`
- Test: response-header verification plus full project checks

**Interfaces:**
- Consumes: current Next.js config and Supabase public URL env usage
- Produces: baseline security headers on app responses

- [ ] **Step 1: Write the failing verification target**

```powershell
Invoke-WebRequest -Uri http://localhost:3000/sign-in -Method Head | Select-Object -ExpandProperty Headers
```

- [ ] **Step 2: Verify the red state**

Run the header check above
Expected: missing CSP, frame, content-type, referrer, and permissions headers

- [ ] **Step 3: Implement the minimal config**

```ts
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: buildCsp(process.env.NODE_ENV, supabaseUrl) },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // existing config
};
```

- [ ] **Step 4: Run the project checks**

Run: `npm run check`
Expected: PASS

- [ ] **Step 5: Run the production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 6: Verify the headers on a fresh local run**

Run: `Invoke-WebRequest -Uri http://localhost:3000/sign-in -Method Head | Select-Object -ExpandProperty Headers`
Expected: response includes all five target security headers

- [ ] **Step 7: Export the updated app**

Run: `npm run export:project`
Expected: a new zip artifact is created successfully

- [ ] **Step 8: Commit**

```bash
git add next.config.ts
git commit -m "feat: add baseline browser security headers"
```
