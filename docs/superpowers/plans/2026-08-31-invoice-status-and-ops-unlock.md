# Invoice status fix and ops unlock

**Goal:** Make invoice status actually change in production, then remove the
silent-failure and hardcoded-ops gaps that make the console look stuck.

## Root cause (production)

The latest app code writes `invoices.payment_status` directly from Mark paid /
the payment dropdown. Postgres still enforces:

```sql
-- invoices_guard_derived_fields
raise exception
  'Invoice totals and payment status are derived from line items and payment records';
```

So every live payment-status mutation fails. The invoices list never renders
`operationMutationError` (it only appears inside dialogs), so the badge snaps
back and looks stuck.

`document_status` updates (Issue / Void) are allowed. Payment status is not.

Payment status is supposed to be derived by `recalculate_invoice_totals` from
`payments` rows. The console never wrote payment records.

## Plan

1. **Stop writing `payment_status`.** Plan and write `payments` rows so the
   existing trigger derives Unpaid / Part paid / Paid / Refunded.
2. **Issue drafts first** when Mark paid / Part paid runs, then sync payments.
3. **Show failures** on the invoices list and document view.
4. **Unlock dashboard numbers** that are hardcoded to `0`.
5. **Save demo invoices**, match jobs by `clientId`, allow extra properties.
6. **Mark sent** for issued invoices (display already supports Sent).
7. **Harden mapping** so one unknown DB value cannot blank the whole list.
8. **Baseline security headers** (planned, never shipped).

No new Supabase migration is required for the status fix. Vercel auto-deploy
from `main` is enough.

## Payment write rules

| Target     | Payments write                                              |
| ---------- | ----------------------------------------------------------- |
| Unpaid     | Void recorded payments                                      |
| Part paid  | Void recorded if needed; insert ~50% of total (clamped)     |
| Paid       | Insert remaining balance as `recorded`                      |
| Refunded   | Void recorded; insert a `refunded` payment                  |

Zero-total invoices cannot be marked paid through the derived trigger and
return a clear error instead of failing silently.

## Out of scope

Full accounting ledger UI, amount-entry modal for every part-payment, and a
rewrite of `console-app.tsx` into feature modules.
