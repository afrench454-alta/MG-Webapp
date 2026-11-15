begin;

create function public.save_direct_job_quote(target_business_id uuid, target_job_id uuid, draft jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  visit public.jobs%rowtype;
  new_quote_id uuid;
begin
  if auth.uid() is null or not coalesce(public.can_manage_business(target_business_id), false) then
    raise exception 'Only managers can save quotes' using errcode = '42501';
  end if;
  if jsonb_typeof(draft) is distinct from 'object'
    or draft ?| array['id', 'clientId', 'propertyId', 'inlineClient', 'jobRequestId', 'directJobId'] then
    raise exception 'Use the client and service address from the job';
  end if;

  select * into visit from public.jobs
    where id = target_job_id and business_id = target_business_id for update;
  if not found or visit.job_request_id is not null or visit.status = 'cancelled' then
    raise exception 'Choose a direct job that has not been cancelled';
  end if;
  if visit.quote_id is not null then
    raise exception 'This job already has a quote. Open it from the job card.';
  end if;

  -- Share the invoice draft's source lock before checking history and linking.
  perform pg_advisory_xact_lock(hashtextextended('invoice-source:' || target_business_id::text, 0));
  if exists (select 1 from public.invoices where job_id = visit.id and business_id = target_business_id) then
    raise exception 'This job already has invoice history';
  end if;

  new_quote_id := public.save_work_quote(target_business_id, draft || jsonb_build_object(
    'clientId', visit.client_id, 'propertyId', visit.service_address_id
  ));
  update public.jobs set quote_id = new_quote_id where id = visit.id and business_id = target_business_id;
  return new_quote_id;
end;
$$;

-- Keep original and revised quotes tied to the same billable visit.
create function public.job_for_quote_lineage(tenant_id uuid, target_quote_id uuid)
returns uuid language sql stable set search_path = '' as $$
  with recursive lineage as (
    select id, revision_of_quote_id from public.quotes
      where business_id = tenant_id and id = target_quote_id
    union
    select q.id, q.revision_of_quote_id from public.quotes q
      join lineage l on q.id = l.revision_of_quote_id where q.business_id = tenant_id
  )
  select j.id from public.jobs j join lineage l on l.id = j.quote_id
    where j.business_id = tenant_id and j.status <> 'cancelled'
    order by (j.quote_id = target_quote_id) desc, j.id limit 1
$$;
revoke all on function public.job_for_quote_lineage(uuid, uuid) from public, anon, authenticated;

create function public.guard_linked_quote_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.client_id, new.service_address_id, new.job_request_id)
    is distinct from (old.client_id, old.service_address_id, old.job_request_id)
    and exists (select 1 from public.jobs j where j.id = public.job_for_quote_lineage(old.business_id, old.id) and j.job_request_id is null) then
    raise exception 'A quote linked to a job must keep its client, site and request';
  end if;
  return new;
end;
$$;

create trigger quotes_guard_linked_identity
  before update of client_id, service_address_id, job_request_id on public.quotes
  for each row execute function public.guard_linked_quote_identity();

revoke all on function public.guard_linked_quote_identity() from public, anon, authenticated;
revoke all on function public.save_direct_job_quote(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_direct_job_quote(uuid, uuid, jsonb) to authenticated;

create or replace function public.save_invoice_draft(draft jsonb)
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
  quote_visit uuid;
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

  if wanted_quote is not null then
    quote_visit := public.job_for_quote_lineage(tenant, wanted_quote);
    if quote_visit is not null then
      if wanted_job is not null and wanted_job <> quote_visit then
        raise exception 'The quote and visit must belong to the same work.';
      end if;
      wanted_job := quote_visit;
    end if;
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
    if source_job.quote_id is not null and wanted_quote is not null and source_job.quote_id <> wanted_quote and wanted_job is distinct from quote_visit then
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
    if wanted_job is not null and source_job.quote_id is distinct from wanted_quote and wanted_job is distinct from quote_visit and (
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

commit;
