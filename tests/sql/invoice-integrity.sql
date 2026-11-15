-- Run on a disposable PostgreSQL database after applying the migrations.
begin;

insert into auth.users (id, email) values
  ('b1000000-0000-4000-8000-000000000001', 'invoice-owner@example.test'),
  ('b1000000-0000-4000-8000-000000000002', 'invoice-coowner@example.test'),
  ('b1000000-0000-4000-8000-000000000003', 'invoice-worker@example.test'),
  ('b1000000-0000-4000-8000-000000000004', 'invoice-outsider@example.test');

insert into public.businesses (id, owner_user_id, name) values
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'Invoice Test Issuer'),
  ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000004', 'Invoice Test Tenant B');

insert into public.profiles (id, business_id, role) values
  ('b1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'co_owner'),
  ('b1000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000001', 'technician');

insert into public.clients (id, business_id, display_name) values
  ('b3000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'Invoice Test Customer'),
  ('b3000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', 'Invoice Test Tenant B Customer');

insert into public.client_addresses (id, business_id, client_id, line_1) values
  ('b4000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', '1 Synthetic Street'),
  ('b4000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', '2 Synthetic Street');

insert into public.job_requests (id, business_id, client_id, service_address_id, title) values
  ('b5000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'Direct request'),
  ('b5000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'Visit request');

insert into public.quotes (id, business_id, client_id, service_address_id, title, status)
values ('b6000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000001',
  'b3000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000001', 'Accepted quote', 'draft');
insert into public.quote_line_items (business_id, quote_id, description, unit_price, tax_rate)
values ('b2000000-0000-4000-8000-000000000001', 'b6000000-0000-4000-8000-000000000001', 'Quote work', 200, 0);
update public.quotes set status = 'approved' where id = 'b6000000-0000-4000-8000-000000000001';

insert into public.jobs (id,business_id,client_id,service_address_id,job_request_id,quote_id,title,status) values
  ('b7000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001',
   'b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001',
   'b5000000-0000-4000-8000-000000000002',null,'Completed request visit','completed'),
  ('b7000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001',
   'b3000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001',
   null,'b6000000-0000-4000-8000-000000000001','Completed quote visit','completed');

set local role authenticated;

do $$
<<invoice_integrity>>
declare
  request_visit_id uuid;
  tenant constant uuid := 'b2000000-0000-4000-8000-000000000001';
  customer constant uuid := 'b3000000-0000-4000-8000-000000000001';
  site constant uuid := 'b4000000-0000-4000-8000-000000000001';
  direct_request constant uuid := 'b5000000-0000-4000-8000-000000000001';
  visit_request constant uuid := 'b5000000-0000-4000-8000-000000000002';
  accepted_quote constant uuid := 'b6000000-0000-4000-8000-000000000001';
  request_visit constant uuid := 'b7000000-0000-4000-8000-000000000001';
  quote_visit constant uuid := 'b7000000-0000-4000-8000-000000000002';
  old_draft jsonb;
  changed_draft jsonb;
  payment jsonb;
  refund jsonb;
  invoice_id uuid;
  paid_receipt uuid;
  direct_invoice uuid;
  replacement_id uuid;
  issued_version integer;
begin
  perform set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
  old_draft := jsonb_build_object(
    'idempotencyKey', gen_random_uuid(), 'clientId', customer, 'propertyId', site,
    'extraPropertyIds', jsonb_build_array('b4000000-0000-4000-8000-000000000002'),
    'issueDate', '2026-08-01', 'dueDate', '2026-08-31', 'serviceDate', '2026-07-30',
    'scope', 'Front and back garden cleanup', 'notes', 'Customer note', 'internalNotes', 'Internal sentinel',
    'terms', 'Net 30', 'paymentInstructions', 'Use invoice number', 'reference', 'PO-DRAFT-42',
    'billingName', 'Accounts Team', 'billingAddress', 'PO Box 400',
    'recipientName', 'Finance', 'recipientEmail', 'finance@example.test',
    'items', '[{"label":"Labour","description":"Garden service","quantity":1.25,"unitLabel":"hours","rate":160}]'::jsonb
  );
  invoice_id := public.save_invoice_draft(old_draft);
  if invoice_id <> public.save_invoice_draft(old_draft) then raise exception 'Draft retry changed the ID'; end if;
  begin
    perform public.save_invoice_draft(old_draft || '{"notes":"Changed using original key"}');
    raise exception using errcode = 'XX000', message = 'Draft idempotency accepted a different payload';
  exception when raise_exception then
    if sqlerrm not like '%already used%' then raise; end if;
  end;
  if not exists (select 1 from public.invoices i where i.id = invoice_id and i.draft_version = 1
      and issue_date = date '2026-08-01' and due_date = date '2026-08-31' and service_date = date '2026-07-30'
      and scope_of_work = 'Front and back garden cleanup' and customer_message = 'Customer note'
      and internal_notes = 'Internal sentinel' and payment_instructions = 'Use invoice number'
      and document_terms = 'Net 30' and external_reference = 'PO-DRAFT-42'
      and recipient_name = 'Finance' and recipient_email = 'finance@example.test'
      and billing_name = 'Accounts Team' and billing_address_text = 'PO Box 400'
      and total = 200 and job_id is null and quote_id is null and request_id is null)
    or not exists (select 1 from public.invoice_line_items li where li.invoice_id = invoice_integrity.invoice_id
      and label = 'Labour' and unit_label = 'hours' and quantity = 1.25 and unit_price = 160)
    or (select count(*) from public.invoice_service_addresses isa where isa.invoice_id = invoice_integrity.invoice_id) <> 2
  then raise exception 'Invoice draft lost header, line or site details'; end if;

  changed_draft := old_draft || jsonb_build_object('id', invoice_id, 'expectedVersion', 1, 'idempotencyKey', gen_random_uuid(), 'notes', 'Updated');
  begin
    perform public.save_invoice_draft(changed_draft || '{"items":[{"description":"Overflow","quantity":100000,"rate":10000000}]}');
    raise exception using errcode = 'XX000', message = 'An overflowing line did not fail the save';
  exception when numeric_value_out_of_range then null;
  end;
  if not exists (select 1 from public.invoices i where id = invoice_id and customer_message = 'Customer note'
    and draft_version = 1 and total = 200) or not exists (select 1 from public.invoice_line_items li
      where li.invoice_id = invoice_integrity.invoice_id and label = 'Labour') then
    raise exception 'Line failure left partial changes';
  end if;
  perform public.save_invoice_draft(changed_draft);
  begin
    perform public.save_invoice_draft(changed_draft || jsonb_build_object('idempotencyKey', gen_random_uuid()));
    raise exception using errcode = 'XX000', message = 'Stale draft edit succeeded';
  exception when raise_exception then
    if sqlerrm not like '%draft changed%' then raise; end if;
  end;
  begin
    perform public.transition_invoice(invoice_id, 'issue', 1);
    raise exception using errcode = 'XX000', message = 'Stale invoice issue succeeded';
  exception when raise_exception then
    if sqlerrm not like '%draft changed%' then raise; end if;
  end;

  select draft_version into issued_version from public.invoices where id = invoice_id;
  perform public.transition_invoice(invoice_id, 'issue', issued_version);
  perform public.transition_invoice(invoice_id, 'issue', issued_version);
  update public.clients set display_name = 'Renamed Customer' where id = customer;
  update public.client_addresses set line_1 = 'Renamed Street' where id = site;
  update public.businesses set name = 'Renamed Issuer' where id = tenant;
  if not exists (select 1 from public.invoices i where i.id = invoice_id and i.document_status = 'issued'
      and i.issue_snapshot->>'clientName' = 'Invoice Test Customer'
      and i.issue_snapshot->'issuer'->>'name' = 'Invoice Test Issuer'
      and i.issue_snapshot->'serviceAddresses'->>0 = '1 Synthetic Street'
      and i.issue_snapshot->>'billingAddress' = 'PO Box 400'
      and not (i.issue_snapshot::text like '%Internal sentinel%')) then
    raise exception 'Issued invoice snapshot changed or exposed internal notes';
  end if;
  begin
    update public.invoice_line_items as li set unit_price = 1 where li.invoice_id = invoice_integrity.invoice_id;
    raise exception using errcode = 'XX000', message = 'Manager edited an issued line through direct API';
  exception when insufficient_privilege then null;
  end;
  perform public.transition_invoice(invoice_id, 'sent');
  perform set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000002', true);
  payment := jsonb_build_object(
    'invoiceId', invoice_id, 'idempotencyKey', gen_random_uuid(), 'kind', 'receipt',
    'amount', 75, 'method', 'cash', 'paidOn', '2026-08-03', 'reference', 'RCPT-1');
  perform public.record_invoice_payment(payment);
  perform public.record_invoice_payment(payment);
  if not exists (select 1 from public.invoices where id = invoice_id and amount_paid = 75
    and balance_due = 125 and payment_status = 'partially_paid')
    or (select count(*) from public.payments p where p.invoice_id = invoice_integrity.invoice_id) <> 1
  then raise exception 'Partial payment or replay is wrong'; end if;
  select p.id into paid_receipt from public.payments p where p.invoice_id = invoice_integrity.invoice_id;
  perform public.record_invoice_payment(payment || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'amount', 125, 'reference', 'RCPT-2'));
  if not exists (select 1 from public.invoices where id = invoice_id and amount_paid = 200
    and balance_due = 0 and payment_status = 'paid') then raise exception 'Remaining receipt did not pay the invoice'; end if;
  refund := payment || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'kind', 'refund', 'receiptId', paid_receipt,
    'amount', 25, 'reason', 'Cash returned');
  perform public.record_invoice_payment(refund);
  perform public.record_invoice_payment(refund || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'kind', 'reversal',
    'amount', 10, 'reason', 'Wrong denomination entered'));
  begin
    perform public.record_invoice_payment(refund || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'amount', 41));
    raise exception using errcode = 'XX000', message = 'Overcorrection was accepted';
  exception when raise_exception then
    if sqlerrm not like '%available receipt%' then raise; end if;
  end;
  if not exists (select 1 from public.invoices where id = invoice_id and amount_paid = 165
    and balance_due = 35 and payment_status = 'partially_paid')
    or not exists (select 1 from public.payments where id = paid_receipt and amount = 75 and status = 'recorded')
  then raise exception 'Adjusted totals are wrong or the original receipt changed'; end if;
  begin
    perform public.transition_invoice(invoice_id, 'void');
    raise exception using errcode = 'XX000', message = 'Invoice with payment history was voided';
  exception when raise_exception then
    if sqlerrm not like '%payment history%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000003', true);
  begin
    perform public.record_invoice_payment(payment);
    raise exception using errcode = 'XX000', message = 'Technician posted a payment';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from public.invoices where id = invoice_id) then raise exception 'Technician read billing data'; end if;
  perform set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000004', true);
  begin
    perform public.record_invoice_payment(payment);
    raise exception using errcode = 'XX000', message = 'Another tenant posted a payment';
  exception when raise_exception then
    if sqlerrm not like '%Invoice not found%' then raise; end if;
  end;
  if exists (select 1 from public.invoices where id = invoice_id) then raise exception 'Tenant B read Tenant A invoice'; end if;

  perform set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);
  direct_invoice := public.save_invoice_draft(old_draft || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'requestId', direct_request));
  insert into public.jobs (business_id,client_id,service_address_id,job_request_id,title,status)
    values (tenant, customer, site, direct_request, 'Later visit', 'completed') returning id into request_visit_id;
  begin
    perform public.save_invoice_draft(old_draft || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'jobId', request_visit_id));
    raise exception using errcode = 'XX000', message = 'Later visit duplicated the direct request invoice';
  exception when raise_exception then
    if sqlerrm not like '%already exists%' then raise; end if;
  end;
  begin
    perform public.save_invoice_draft(old_draft || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'requestId', visit_request));
    raise exception using errcode = 'XX000', message = 'Direct request invoice ignored its existing visit';
  exception when raise_exception then
    if sqlerrm not like '%has visits%' then raise; end if;
  end;
  perform public.save_invoice_draft(old_draft || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'jobId', request_visit));
  perform public.save_invoice_draft(old_draft || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'jobId', quote_visit));
  begin
    perform public.save_invoice_draft(old_draft || jsonb_build_object('idempotencyKey', gen_random_uuid(), 'quoteId', accepted_quote));
    raise exception using errcode = 'XX000', message = 'Quote conversion duplicated an existing invoice for its completed visit';
  exception when raise_exception then
    if sqlerrm not like '%completed visit%' and sqlerrm not like '%already exists%' then raise; end if;
  end;

  perform public.transition_invoice(direct_invoice, 'issue', 1);
  replacement_id := public.save_invoice_draft(old_draft || jsonb_build_object('idempotencyKey', gen_random_uuid(),
    'requestId', direct_request, 'replacesInvoiceId', direct_invoice, 'correctionReason', 'Original billing address incorrect'));
  if not exists (select 1 from public.invoices where id = direct_invoice and document_status = 'issued' and issue_snapshot is not null)
    or not exists (select 1 from public.invoices where id = replacement_id and replaces_invoice_id = direct_invoice
      and document_status = 'draft' and correction_reason = 'Original billing address incorrect') then
    raise exception 'Preparing a replacement changed the original invoice';
  end if;
  perform public.transition_invoice(replacement_id, 'issue', 1);
  if not exists (select 1 from public.invoices where id = direct_invoice and document_status = 'void' and issue_snapshot is not null)
    then raise exception 'Issuing the replacement did not void the original'; end if;

  replacement_id := public.save_invoice_draft((old_draft - 'clientId' - 'propertyId' - 'extraPropertyIds') ||
    jsonb_build_object('idempotencyKey', gen_random_uuid(), 'inlineClient', jsonb_build_object('name', 'Synthetic minimal contact')));
  if not exists (select 1 from public.invoices i join public.clients c on c.id = i.client_id
    where i.id = replacement_id and i.billing_address_id is null and c.display_name = 'Synthetic minimal contact'
      and c.phone is null and c.email is null) then raise exception 'Name-only invoice client did not save atomically'; end if;
end;
$$;

do $$
begin
  if has_function_privilege('anon', 'public.save_invoice_draft(jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.record_invoice_payment(jsonb)', 'EXECUTE') then
    raise exception 'Anonymous callers can execute financial writes';
  end if;
end;
$$;

rollback;
