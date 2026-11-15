begin;

alter table public.invoices
  add column request_id uuid,
  add column draft_version integer not null default 1 check (draft_version > 0),
  add column scope_of_work text,
  add column service_date date,
  add column external_reference text,
  add column document_terms text,
  add column billing_name text,
  add column billing_address_text text,
  add column recipient_name text,
  add column recipient_email text,
  add column issue_snapshot jsonb check (issue_snapshot is null or jsonb_typeof(issue_snapshot) = 'object'),
  add column duplicate_source boolean not null default false,
  add column separates_customer_fields boolean not null default false,
  add column replaces_invoice_id uuid unique,
  add column correction_reason text,
  add foreign key (request_id, business_id) references public.job_requests (id, business_id) on delete restrict,
  add foreign key (replaces_invoice_id, business_id) references public.invoices (id, business_id) on delete restrict;

-- Recover known links without rewriting any historical billing documents.
update public.invoices i set request_id = coalesce(
  (select j.job_request_id from public.jobs j where j.id = i.job_id and j.business_id = i.business_id),
  (select q.job_request_id from public.quotes q where q.id = i.quote_id and q.business_id = i.business_id)
);
update public.invoices i set duplicate_source = true
where i.document_status <> 'void' and exists (
  select 1 from public.invoices other where other.business_id = i.business_id
    and other.id <> i.id and other.document_status <> 'void'
    and (other.job_id = i.job_id or other.quote_id = i.quote_id
      or (other.request_id = i.request_id and (other.job_id is null or i.job_id is null)))
);
create index invoices_linked_job_idx on public.invoices (business_id, job_id) where job_id is not null;
create index invoices_linked_request_idx on public.invoices (business_id, request_id) where request_id is not null;
create index invoices_linked_quote_idx on public.invoices (business_id, quote_id) where quote_id is not null;

alter table public.payments
  add column entry_kind text check (entry_kind in ('receipt', 'refund', 'reversal')),
  add column paid_on date,
  add column receipt_id uuid,
  add column idempotency_key uuid,
  add unique (invoice_id, business_id, id),
  add foreign key (invoice_id, business_id, receipt_id) references public.payments (invoice_id, business_id, id) on delete restrict,
  add check (
    (entry_kind is null and paid_on is null and receipt_id is null and idempotency_key is null)
    or (entry_kind is not null and paid_on is not null and idempotency_key is not null
      and ((entry_kind = 'receipt' and receipt_id is null and status = 'recorded')
        or (entry_kind = 'refund' and receipt_id is not null and status = 'refunded')
        or (entry_kind = 'reversal' and receipt_id is not null and status = 'recorded')))
  );
create unique index payments_idempotency_idx on public.payments (business_id, idempotency_key)
  where idempotency_key is not null;
create index payments_receipt_idx on public.payments (business_id, invoice_id, receipt_id)
  where receipt_id is not null;

create table public.invoice_draft_submissions (
  business_id uuid not null references public.businesses(id) on delete cascade,
  submission_id uuid not null,
  actor_id uuid references auth.users(id) on delete set null,
  invoice_id uuid,
  payload_hash bytea not null,
  primary key (business_id, submission_id),
  foreign key (invoice_id, business_id) references public.invoices(id, business_id) on delete set null (invoice_id)
);
alter table public.invoice_draft_submissions enable row level security;
revoke all on public.invoice_draft_submissions from public, anon, authenticated;

-- Managers write these records through the checked transactional operations below.
revoke insert, update, delete, truncate on public.invoices, public.invoice_line_items, public.invoice_service_addresses, public.payments
  from public, anon, authenticated;
grant select on public.invoices, public.invoice_line_items, public.invoice_service_addresses, public.payments to authenticated;
drop function if exists public.create_invoice_with_details(uuid, uuid, uuid[], uuid, integer, text, jsonb);

create or replace function public.recalculate_invoice_totals(target_invoice_id uuid, target_business_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  next_subtotal numeric(12, 2);
  next_tax_total numeric(12, 2);
  next_total numeric(12, 2);
  next_amount_paid numeric(12, 2);
  has_refund boolean;
begin
  select coalesce(sum(line_subtotal), 0), coalesce(sum(tax_amount), 0), coalesce(sum(line_total), 0)
    into next_subtotal, next_tax_total, next_total
  from public.invoice_line_items
  where invoice_id = target_invoice_id and business_id = target_business_id;

  -- Imported refunds were previously recorded separately after voiding their receipts.
  -- Only explicitly linked adjustments subtract from a receipt.
  select greatest(coalesce(sum(case
      when receipt_id is not null then -amount
      when status = 'recorded' then amount else 0 end), 0), 0),
    coalesce(bool_or(status = 'refunded'), false)
    into next_amount_paid, has_refund
  from public.payments
  where invoice_id = target_invoice_id and business_id = target_business_id;

  update public.invoices set subtotal = next_subtotal, tax_total = next_tax_total,
    total = next_total, amount_paid = next_amount_paid,
    payment_status = case
      when next_total > 0 and next_amount_paid >= next_total then 'paid'::public.invoice_payment_status
      when next_amount_paid > 0 then 'partially_paid'::public.invoice_payment_status
      when has_refund then 'refunded'::public.invoice_payment_status
      else 'unpaid'::public.invoice_payment_status end
  where id = target_invoice_id and business_id = target_business_id;
end;
$$;

-- Coordinate with visit writes so a request-direct eligibility check cannot race a new visit.
create function public.lock_invoice_request_sources()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('invoice-source:' || coalesce(new.business_id, old.business_id)::text, 0));
  if tg_op = 'DELETE' then
    if exists (select 1 from public.invoices where job_id = old.id and business_id = old.business_id) then
      raise exception 'This visit has invoice history. Keep the visit and cancel it instead.';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and (new.business_id, new.client_id, new.job_request_id, new.quote_id, new.service_address_id)
      is distinct from (old.business_id, old.client_id, old.job_request_id, old.quote_id, old.service_address_id)
      and exists (select 1 from public.invoices where job_id = old.id and business_id = old.business_id) then
    raise exception 'This visit has an invoice and its source links must be preserved.';
  end if;
  return new;
end;
$$;
revoke all on function public.lock_invoice_request_sources() from public, anon, authenticated;
create trigger jobs_lock_invoice_request_sources
  before insert or delete or update of status, business_id, client_id, job_request_id, quote_id, service_address_id on public.jobs
  for each row execute function public.lock_invoice_request_sources();

create function public.save_invoice_draft(draft jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tenant uuid := public.current_business_id();
  actor uuid := auth.uid();
  submission uuid := nullif(draft->>'idempotencyKey', '')::uuid;
  wanted_invoice uuid := nullif(draft->>'id', '')::uuid;
  wanted_client uuid := nullif(draft->>'clientId', '')::uuid;
  wanted_site uuid := nullif(draft->>'propertyId', '')::uuid;
  wanted_job uuid := nullif(draft->>'jobId', '')::uuid;
  wanted_request uuid := nullif(draft->>'requestId', '')::uuid;
  wanted_quote uuid := nullif(draft->>'quoteId', '')::uuid;
  wanted_replacement uuid := nullif(draft->>'replacesInvoiceId', '')::uuid;
  wanted_correction text := nullif(btrim(draft->>'correctionReason'), '');
  wanted_issue date := (draft->>'issueDate')::date;
  wanted_due date := nullif(draft->>'dueDate', '')::date;
  wanted_service date := nullif(draft->>'serviceDate', '')::date;
  wanted_items jsonb := draft->'items';
  inline_client jsonb := nullif(draft->'inlineClient', 'null'::jsonb);
  sites uuid[];
  old_invoice public.invoices%rowtype;
  replacement public.invoices%rowtype;
  prior public.invoice_draft_submissions%rowtype;
  source_job public.jobs%rowtype;
  source_quote public.quotes%rowtype;
  source_request public.job_requests%rowtype;
  canonical_hash bytea;
begin
  if actor is null or tenant is null or not public.can_manage_business(tenant) then
    raise exception 'Only an owner or co-owner can save an invoice.' using errcode = '42501';
  end if;
  if submission is null then raise exception 'A draft submission identifier is required.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('invoice-source:' || tenant::text, 0));
  canonical_hash := sha256(convert_to(draft::text, 'UTF8'));
  select * into prior from public.invoice_draft_submissions
    where business_id = tenant and submission_id = submission;
  if found then
    if prior.actor_id is distinct from actor or prior.payload_hash is distinct from canonical_hash then
      raise exception 'That draft submission was already used. Reopen the draft and try again.';
    end if;
    if prior.invoice_id is null then raise exception 'That draft was deleted.'; end if;
    return prior.invoice_id;
  end if;

  if wanted_invoice is not null then
    select * into old_invoice from public.invoices where id = wanted_invoice and business_id = tenant for update;
    if not found or old_invoice.document_status <> 'draft' then
      raise exception 'Only draft invoices can be edited.';
    end if;
    if old_invoice.draft_version is distinct from (draft->>'expectedVersion')::integer then
      raise exception 'This draft changed after you opened it. Reload it before saving.';
    end if;
    if exists (select 1 from public.payments where invoice_id = wanted_invoice and business_id = tenant) then
      raise exception 'A draft with payment history cannot be edited.';
    end if;
    if old_invoice.replaces_invoice_id is not null and (
      wanted_client is distinct from old_invoice.client_id or wanted_job is distinct from old_invoice.job_id
      or wanted_quote is distinct from old_invoice.quote_id or wanted_request is distinct from old_invoice.request_id
    ) then raise exception 'A replacement draft must retain the original customer and work links.'; end if;
    if old_invoice.duplicate_source and (
      wanted_client is distinct from old_invoice.client_id or wanted_job is distinct from old_invoice.job_id
      or wanted_quote is distinct from old_invoice.quote_id or wanted_request is distinct from old_invoice.request_id
    ) then raise exception 'A historical duplicate must retain its existing work links.'; end if;
  end if;

  if wanted_replacement is not null then
    if wanted_invoice is not null or wanted_correction is null or length(wanted_correction) > 1000 then
      raise exception 'Enter a reason to create a replacement invoice.';
    end if;
    select * into replacement from public.invoices where id = wanted_replacement and business_id = tenant for update;
    if not found or replacement.document_status not in ('issued', 'sent', 'overdue') or exists (
      select 1 from public.payments where invoice_id = wanted_replacement and business_id = tenant
    ) then raise exception 'Only issued invoices without payment history can be replaced.'; end if;
    if (wanted_client, wanted_job, wanted_quote, wanted_request) is distinct from
      (replacement.client_id, replacement.job_id, replacement.quote_id, replacement.request_id)
    then raise exception 'A replacement must retain the original customer and work links.'; end if;
  elsif wanted_correction is not null then
    raise exception 'A correction reason requires a replacement invoice.';
  end if;

  if wanted_issue is null or wanted_due < wanted_issue then raise exception 'Enter an issue date and a valid due date.'; end if;
  if jsonb_typeof(wanted_items) is distinct from 'array' or jsonb_array_length(wanted_items) not between 1 and 100 then
    raise exception 'Enter at least one invoice line item.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(wanted_items) as lines(item)
    where length(btrim(coalesce(item->>'description', ''))) not between 1 and 1000
      or length(item->>'label') > 160 or length(item->>'unitLabel') > 32
      or coalesce((item->>'quantity')::numeric, 0) not between 0.001 and 100000
      or (item->>'quantity')::numeric <> round((item->>'quantity')::numeric, 3)
      or coalesce((item->>'rate')::numeric, -1) not between 0 and 10000000
      or (item->>'rate')::numeric <> round((item->>'rate')::numeric, 2)
  ) then raise exception 'Enter a description, positive quantity (up to 3 decimals) and valid rate (up to 2 decimals) for each line.'; end if;
  if exists (
    select 1 from jsonb_each_text(draft) f(name, value)
    where (name in ('scope','notes','internalNotes','terms','paymentInstructions') and length(value) > 20000)
       or (name in ('reference','billingName','recipientName') and length(value) > 160)
       or (name = 'billingAddress' and length(value) > 1000)
       or (name = 'recipientEmail' and length(value) > 320)
  ) then raise exception 'An invoice field exceeds its maximum length.'; end if;

  if inline_client is not null then
    if wanted_client is not null or wanted_job is not null or wanted_quote is not null
      or wanted_request is not null or wanted_site is not null or wanted_replacement is not null then
      raise exception 'A new customer can only be used on a standalone invoice.';
    end if;
    select client_id, address_id into wanted_client, wanted_site
      from public.create_inline_work_client(tenant, inline_client);
  end if;

  if not exists (select 1 from public.clients where id = wanted_client and business_id = tenant) then
    raise exception 'Choose a customer in this business.';
  end if;

  if wanted_job is null and wanted_quote is not null and wanted_invoice is null and wanted_replacement is null then
    select j.id into wanted_job from public.jobs j
    where j.business_id = tenant and j.quote_id = wanted_quote and j.status <> 'cancelled';
  end if;

  if wanted_job is not null then
    select * into source_job from public.jobs where id = wanted_job and business_id = tenant;
    if not found or source_job.client_id is distinct from wanted_client then
      raise exception 'Choose a visit for this customer.';
    end if;
    if (wanted_invoice is null or wanted_job is distinct from old_invoice.job_id) and wanted_replacement is null
      and source_job.status <> 'completed' then
      raise exception 'Choose a completed visit.';
    end if;
    if wanted_request is not null and source_job.job_request_id is distinct from wanted_request then
      raise exception 'The visit does not belong to that request.';
    end if;
    wanted_request := source_job.job_request_id;
    if source_job.quote_id is not null and wanted_quote is not null and source_job.quote_id <> wanted_quote then
      raise exception 'The visit belongs to a different quote.';
    end if;
  end if;
  if wanted_quote is not null then
    select * into source_quote from public.quotes where id = wanted_quote and business_id = tenant;
    if not found or source_quote.client_id is distinct from wanted_client then
      raise exception 'Choose a quote for this customer.';
    end if;
    if source_quote.status <> 'approved' and wanted_quote is distinct from old_invoice.quote_id and wanted_replacement is null then
      raise exception 'Choose an accepted quote.';
    end if;
    if wanted_request is not null and source_quote.job_request_id is not null
      and source_quote.job_request_id <> wanted_request then
      raise exception 'The quote belongs to a different request.';
    end if;
    if wanted_job is not null and source_job.quote_id is distinct from wanted_quote and (
      source_quote.job_request_id is null or source_quote.job_request_id is distinct from source_job.job_request_id
    ) then raise exception 'The quote and visit must belong to the same work.'; end if;
    wanted_request := coalesce(wanted_request, source_quote.job_request_id);
  end if;
  if wanted_request is not null then
    select * into source_request from public.job_requests where id = wanted_request and business_id = tenant;
    if not found or source_request.client_id is distinct from wanted_client then
      raise exception 'Choose a request for this customer.';
    end if;
    if wanted_job is null and wanted_replacement is null and not coalesce(old_invoice.request_id = wanted_request and old_invoice.job_id is null, false)
      and exists (select 1 from public.jobs where business_id = tenant and job_request_id = wanted_request and status <> 'cancelled') then
      raise exception 'This request has visits. Create the invoice from its completed visit.';
    end if;
  end if;

  if not coalesce(old_invoice.duplicate_source, false) and exists (
    select 1 from public.invoices i where i.business_id = tenant
      and i.id is distinct from wanted_invoice
      and i.id is distinct from coalesce(wanted_replacement, old_invoice.replaces_invoice_id)
      and (i.document_status <> 'void' and (i.job_id = wanted_job
          or (i.job_id is null and i.quote_id = source_job.quote_id)
          or (i.request_id = wanted_request and (i.job_id is null or wanted_job is null)))
        or (i.quote_id = wanted_quote and (i.document_status <> 'void'
          or (wanted_replacement is null and old_invoice.replaces_invoice_id is null))))
  ) then raise exception 'An invoice already exists for this visit, request or quote. Open the existing invoice.'; end if;

  select coalesce(array_agg(site.id order by site.first_position), '{}'::uuid[]) into sites
  from (
    select address_id::uuid as id, min(position) as first_position
    from jsonb_array_elements_text(
      case when wanted_site is null then '[]'::jsonb else jsonb_build_array(wanted_site) end
        || coalesce(draft->'extraPropertyIds', '[]'::jsonb)
    ) with ordinality as input(address_id, position)
    group by address_id::uuid
  ) site;
  if cardinality(sites) > 21 or exists (
    select 1 from unnest(sites) picked(id) where not exists (
      select 1 from public.client_addresses a where a.id = picked.id and a.business_id = tenant and a.client_id = wanted_client
    )
  ) then raise exception 'Choose service sites that belong to this customer.'; end if;
  if wanted_site is null and cardinality(sites) > 0 then wanted_site := sites[1]; end if;

  if wanted_invoice is null then
    insert into public.invoices (business_id, client_id, title, issue_date, due_date, replaces_invoice_id, correction_reason, created_by)
      values (tenant, wanted_client, 'Invoice', wanted_issue, wanted_due, wanted_replacement, wanted_correction, actor)
      returning id into wanted_invoice;
  end if;

  update public.invoices set
    client_id = wanted_client, billing_address_id = wanted_site, job_id = wanted_job,
    request_id = wanted_request, quote_id = wanted_quote,
    issue_date = wanted_issue, due_date = wanted_due, service_date = wanted_service,
    scope_of_work = nullif(btrim(draft->>'scope'), ''), external_reference = nullif(btrim(draft->>'reference'), ''),
    billing_name = nullif(btrim(draft->>'billingName'), ''), billing_address_text = nullif(btrim(draft->>'billingAddress'), ''),
    recipient_name = nullif(btrim(draft->>'recipientName'), ''), recipient_email = nullif(btrim(draft->>'recipientEmail'), ''),
    customer_message = nullif(btrim(draft->>'notes'), ''), internal_notes = nullif(btrim(draft->>'internalNotes'), ''),
    document_terms = nullif(btrim(draft->>'terms'), ''), payment_instructions = nullif(btrim(draft->>'paymentInstructions'), ''),
    separates_customer_fields = true,
    draft_version = coalesce(old_invoice.draft_version + 1, 1)
  where id = wanted_invoice and business_id = tenant;

  delete from public.invoice_line_items where invoice_id = wanted_invoice and business_id = tenant;
  delete from public.invoice_service_addresses where invoice_id = wanted_invoice and business_id = tenant;
  insert into public.invoice_line_items (business_id, invoice_id, position, label, description, quantity, unit_label, unit_price, tax_rate)
  select tenant, wanted_invoice, ordinality - 1, nullif(btrim(item->>'label'), ''),
    btrim(item->>'description'), (item->>'quantity')::numeric, coalesce(nullif(btrim(item->>'unitLabel'), ''), 'item'),
    (item->>'rate')::numeric, 0
  from jsonb_array_elements(wanted_items) with ordinality as lines(item, ordinality);

  insert into public.invoice_service_addresses (business_id, invoice_id, client_address_id, position)
    select tenant, wanted_invoice, site, position - 1 from unnest(sites) with ordinality as picked(site, position);

  insert into public.invoice_draft_submissions values (tenant, submission, actor, wanted_invoice, canonical_hash);
  return wanted_invoice;
end;
$$;

create function public.record_invoice_payment(payment jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tenant uuid := public.current_business_id();
  actor uuid := auth.uid();
  wanted_invoice uuid := (payment->>'invoiceId')::uuid;
  wanted_submission uuid := (payment->>'idempotencyKey')::uuid;
  wanted_kind text := payment->>'kind';
  wanted_amount numeric := (payment->>'amount')::numeric;
  wanted_date date := (payment->>'paidOn')::date;
  wanted_method public.payment_method := (payment->>'method')::public.payment_method;
  wanted_reference text := nullif(btrim(payment->>'reference'), '');
  wanted_receipt uuid := nullif(payment->>'receiptId', '')::uuid;
  wanted_reason text := nullif(btrim(payment->>'reason'), '');
  invoice public.invoices%rowtype;
  entry public.payments%rowtype;
  available numeric;
begin
  if actor is null or tenant is null or not public.can_manage_business(tenant) then
    raise exception 'Only an owner or co-owner can record payments.' using errcode = '42501';
  end if;
  if wanted_submission is null or wanted_kind is null or wanted_kind not in ('receipt', 'refund', 'reversal')
    or wanted_amount is null or wanted_amount not between 0.01 and 9999999999.99 or wanted_amount <> round(wanted_amount, 2)
    or wanted_date is null or wanted_date > (now() at time zone 'Australia/Brisbane')::date
    or wanted_method is null or length(wanted_reference) > 160 or length(wanted_reason) > 1000 then
    raise exception 'Enter a positive payment amount, actual date and payment method.';
  end if;
  select * into invoice from public.invoices where id = wanted_invoice and business_id = tenant for update;
  if not found then raise exception 'Invoice not found.'; end if;
  select * into entry from public.payments where business_id = tenant and idempotency_key = wanted_submission;
  if found then
    if (entry.invoice_id, entry.recorded_by, entry.entry_kind, entry.amount, entry.paid_on, entry.method,
        entry.reference, entry.receipt_id, entry.notes)
      is distinct from (wanted_invoice, actor, wanted_kind, wanted_amount, wanted_date, wanted_method,
        wanted_reference, wanted_receipt, wanted_reason) then
      raise exception 'That payment submission was already used. Open the payment form again.';
    end if;
    return wanted_invoice;
  end if;
  if invoice.document_status not in ('issued', 'sent', 'overdue') then
    raise exception 'Payments require an issued invoice.';
  end if;

  if wanted_kind = 'receipt' then
    if wanted_receipt is not null or wanted_reason is not null then raise exception 'Receipt details are invalid.'; end if;
    if wanted_amount > invoice.balance_due then raise exception 'The amount exceeds the outstanding balance.'; end if;
  else
    if wanted_receipt is null or wanted_reason is null then raise exception 'Choose a receipt and enter a reason for the correction.'; end if;
    select * into entry from public.payments where id = wanted_receipt and invoice_id = wanted_invoice and business_id = tenant
      and status = 'recorded' and coalesce(entry_kind, 'receipt') = 'receipt';
    if not found or wanted_date < coalesce(entry.paid_on, (entry.paid_at at time zone 'Australia/Brisbane')::date) then
      raise exception 'Choose an active receipt and enter a date on or after it.';
    end if;
    select entry.amount - coalesce(sum(amount), 0) into available from public.payments
      where receipt_id = wanted_receipt and invoice_id = wanted_invoice and business_id = tenant;
    if wanted_amount > available or wanted_amount > invoice.amount_paid then
      raise exception 'The correction exceeds the available receipt amount.';
    end if;
  end if;

  insert into public.payments (business_id, invoice_id, amount, method, status, entry_kind, paid_on, paid_at,
      reference, receipt_id, notes, recorded_by, idempotency_key)
  values (tenant, wanted_invoice, wanted_amount, wanted_method,
    case when wanted_kind = 'refund' then 'refunded'::public.payment_record_status else 'recorded'::public.payment_record_status end,
    wanted_kind, wanted_date, wanted_date::timestamp at time zone 'Australia/Brisbane',
    wanted_reference, wanted_receipt, wanted_reason, actor, wanted_submission);
  return wanted_invoice;
end;
$$;

create function public.transition_invoice(target_invoice uuid, action text, expected_version integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  tenant uuid := public.current_business_id();
  invoice public.invoices%rowtype;
  snapshot jsonb;
begin
  if auth.uid() is null or tenant is null or not public.can_manage_business(tenant) then
    raise exception 'Only an owner or co-owner can manage invoices.' using errcode = '42501';
  end if;
  select * into invoice from public.invoices where id = target_invoice and business_id = tenant for update;
  if not found then raise exception 'Invoice not found.'; end if;
  if action = 'issue' then
    if invoice.document_status = 'issued' then return target_invoice; end if;
    if invoice.document_status <> 'draft' then raise exception 'Only draft invoices can be issued.'; end if;
    if invoice.duplicate_source then
      raise exception 'This draft shares its source with another invoice and requires reconciliation before issue.';
    end if;
    if invoice.draft_version is distinct from expected_version then
      raise exception 'This draft changed after you opened it. Reload and review it before issuing.';
    end if;
    if not exists (select 1 from public.invoice_line_items where invoice_id = target_invoice and business_id = tenant)
      then raise exception 'Add at least one invoice line before issuing.'; end if;
    if invoice.replaces_invoice_id is not null then
      perform 1 from public.invoices where id = invoice.replaces_invoice_id and business_id = tenant
        and document_status in ('issued', 'sent', 'overdue') for update;
      if not found or exists (
        select 1 from public.payments where invoice_id = invoice.replaces_invoice_id and business_id = tenant
      ) then raise exception 'The original invoice is no longer eligible for replacement.'; end if;
      update public.invoices set document_status = 'void' where id = invoice.replaces_invoice_id and business_id = tenant;
    end if;
    select jsonb_strip_nulls(jsonb_build_object(
      'clientName', c.display_name,
      'billingName', invoice.billing_name,
      'billingAddress', invoice.billing_address_text,
      'recipientName', invoice.recipient_name,
      'recipientEmail', invoice.recipient_email,
      'serviceAddresses', coalesce(
        (select jsonb_agg(concat_ws(', ', a.line_1, nullif(a.line_2, ''),
            nullif(concat_ws(' ', a.suburb, a.state_region, a.postcode), '')) order by isa.position)
         from public.invoice_service_addresses isa join public.client_addresses a
           on a.id = isa.client_address_id and a.business_id = isa.business_id
         where isa.invoice_id = target_invoice and isa.business_id = tenant),
        (select jsonb_build_array(concat_ws(', ', a.line_1, nullif(a.line_2, ''),
            nullif(concat_ws(' ', a.suburb, a.state_region, a.postcode), '')))
         from public.client_addresses a where a.id = invoice.billing_address_id and a.business_id = tenant),
        '[]'::jsonb),
      'issuer', jsonb_build_object('name', b.name, 'abn', coalesce(b.abn, ''), 'email', coalesce(b.email, ''),
        'phone', coalesce(b.phone, ''), 'website', coalesce(b.website, ''), 'paymentTo', coalesce(s.payment_to, ''),
        'bsb', coalesce(s.bsb, ''), 'accountNumber', coalesce(s.account_number, ''))
    )) into snapshot
    from public.businesses b join public.clients c on c.business_id = b.id and c.id = invoice.client_id
      left join public.business_settings s on s.business_id = b.id
    where b.id = tenant;
    update public.invoices set document_status = 'issued', issue_snapshot = snapshot
      where id = target_invoice and business_id = tenant;
  elsif action = 'sent' then
    if invoice.document_status = 'sent' then return target_invoice; end if;
    if invoice.document_status <> 'issued' then raise exception 'Only issued invoices can be marked sent.'; end if;
    update public.invoices set document_status = 'sent' where id = target_invoice and business_id = tenant;
  elsif action = 'void' then
    if invoice.document_status = 'void' then return target_invoice; end if;
    if invoice.document_status not in ('issued', 'sent', 'overdue') or exists (
      select 1 from public.payments where invoice_id = target_invoice and business_id = tenant
    ) then raise exception 'Only issued invoices without payment history can be voided.'; end if;
    update public.invoices set document_status = 'void' where id = target_invoice and business_id = tenant;
  elsif action = 'delete' then
    if invoice.document_status <> 'draft' or invoice.replaces_invoice_id is not null or exists (
      select 1 from public.payments where invoice_id = target_invoice and business_id = tenant
    ) then raise exception 'Only ordinary drafts without payment history can be deleted.'; end if;
    delete from public.invoices where id = target_invoice and business_id = tenant;
  else
    raise exception 'Unknown invoice action.';
  end if;
  return target_invoice;
end;
$$;

revoke all on function public.save_invoice_draft(jsonb), public.record_invoice_payment(jsonb),
  public.transition_invoice(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.save_invoice_draft(jsonb), public.record_invoice_payment(jsonb),
  public.transition_invoice(uuid, text, integer) to authenticated;

commit;
