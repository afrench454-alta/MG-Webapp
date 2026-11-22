-- Verify upgraded data and that the current app's write contract remains available.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','1aa00000-0000-4000-8000-000000000001',true);
do $$
declare
  job constant uuid := '1dd00000-0000-4000-8000-000000000001';
  draft constant uuid := '1ee00000-0000-4000-8000-000000000001';
  historical_invoice constant uuid := '1ee00000-0000-4000-8000-000000000002';
  new_invoice uuid;
begin
  if (select count(*) from public.invoices where job_id=job and duplicate_source) <> 2 then
    raise exception 'Historical duplicate source links were lost';
  end if;
  if not exists (
    select 1 from public.invoices
    where id=historical_invoice and document_status='issued' and issue_snapshot is null
  ) then raise exception 'The old issued invoice was rewritten'; end if;
  if not exists (
    select 1 from public.payments
    where id='1ff00000-0000-4000-8000-000000000001' and invoice_id=historical_invoice
      and amount=35 and method='cash' and paid_at='2026-11-17T10:00:00Z'::timestamptz
  ) then raise exception 'The old receipt was rewritten'; end if;

  begin
    perform public.transition_invoice(draft,'issue',1);
    raise exception using errcode='XX000', message='Historical duplicate was issued';
  exception when raise_exception then
    if sqlerrm not like '%requires reconciliation%' then raise; end if;
  end;

  if to_regprocedure('public.create_invoice_with_details(uuid,uuid,uuid[],uuid,integer,text,jsonb)') is not null
    or has_table_privilege('public.invoices','UPDATE') or has_table_privilege('public.payments','UPDATE')
  then raise exception 'Obsolete billing write path remains available'; end if;

  new_invoice := public.save_invoice_draft('{
    "clientId": "1cc00000-0000-4000-8000-000000000001",
    "issueDate": "2026-11-25", "dueDate": "2026-12-17", "notes": "",
    "idempotencyKey": "1aa00000-0000-4000-8000-000000000002",
    "items": [{"description":"Synthetic recovery service","quantity":1.25,"rate":160}]
  }'::jsonb);
  perform public.transition_invoice(new_invoice,'issue',1);
  perform public.record_invoice_payment(jsonb_build_object(
    'invoiceId',new_invoice,'idempotencyKey','1aa00000-0000-4000-8000-000000000003',
    'kind','receipt','amount',75,'paidOn','2026-11-18','method','cash'
  ));
  if not exists (
    select 1 from public.invoices
    where id=new_invoice and issue_snapshot is not null and amount_paid=75 and balance_due=125
  ) then raise exception 'Current app writes did not preserve the new snapshot and ledger'; end if;
end $$;
commit;
