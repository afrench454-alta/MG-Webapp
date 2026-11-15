begin;

alter table public.quotes
  add column customer_reference text,
  add column revision_of_quote_id uuid,
  add column issue_snapshot jsonb,
  add constraint quotes_revision_source_fk foreign key (revision_of_quote_id, business_id)
    references public.quotes (id, business_id) on delete restrict,
  add constraint quotes_revision_source_not_self check (revision_of_quote_id <> id);

create function public.work_quote_snapshot(target_business_id uuid, target_client_id uuid, target_address_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'client', c.display_name, 'address', a.line_1,
    'issuer', jsonb_build_object('name', b.name, 'abn', coalesce(b.abn, ''),
      'email', coalesce(b.email, ''), 'phone', coalesce(b.phone, ''), 'website', coalesce(b.website, ''))
  )
  from public.businesses b
  join public.clients c on c.business_id = b.id and c.id = target_client_id
  left join public.client_addresses a on a.business_id = b.id and a.client_id = c.id and a.id = target_address_id
  where b.id = target_business_id;
$$;

-- Historical rows can only be snapshotted from the values still available at migration time.
update public.quotes q set issue_snapshot = public.work_quote_snapshot(q.business_id, q.client_id, q.service_address_id)
  where q.status <> 'draft';

create function public.guard_quote_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.issue_snapshot is not null then
      raise exception 'New quotes must start as drafts';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'Issued quotes cannot be deleted'; end if;
    return old;
  end if;

  if new.revision_of_quote_id is distinct from old.revision_of_quote_id then
    raise exception 'A quote revision source cannot be changed';
  end if;
  new.sent_at := old.sent_at;
  new.approved_at := old.approved_at;
  new.declined_at := old.declined_at;
  if old.status <> 'draft' then
    if (to_jsonb(new) - array['status', 'updated_at', 'sent_at', 'approved_at', 'declined_at'])
        is distinct from
       (to_jsonb(old) - array['status', 'updated_at', 'sent_at', 'approved_at', 'declined_at']) then
      raise exception 'Issued quotes are locked. Create a revision to change the document.';
    end if;
    if old.status is distinct from new.status and not (
      (old.status = 'sent' and new.status in ('approved', 'declined', 'expired', 'void'))
      or (old.status = 'expired' and new.status = 'void')
      or (old.status = 'declined' and new.status = 'void')
      or (old.status = 'approved' and new.status = 'void')
    ) then
      raise exception 'This quote status change is unavailable';
    end if;
  elsif new.status <> 'draft' then
    if new.status not in ('sent', 'approved', 'void') then
      raise exception 'This quote status change is unavailable';
    end if;
    if not exists (select 1 from public.quote_line_items
      where quote_id = old.id and business_id = old.business_id) then
      raise exception 'Add a line item before issuing a quote';
    end if;
    new.issue_snapshot := public.work_quote_snapshot(new.business_id, new.client_id, new.service_address_id);
  elsif new.issue_snapshot is not null then
    raise exception 'A quote snapshot is created when the quote is issued';
  end if;
  return new;
end;
$$;

create trigger quotes_guard_history before insert or update or delete on public.quotes
  for each row execute function public.guard_quote_history();

create function public.guard_quote_item_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  quote_key uuid;
  business_key uuid;
  parent_status public.quote_status;
begin
  if tg_op = 'UPDATE' and (new.quote_id, new.business_id) is distinct from (old.quote_id, old.business_id) then
    raise exception 'An existing quote line cannot be moved to another quote';
  end if;
  if tg_op = 'DELETE' then
    quote_key := old.quote_id;
    business_key := old.business_id;
  else
    quote_key := new.quote_id;
    business_key := new.business_id;
  end if;
  select status into parent_status from public.quotes
    where id = quote_key and business_id = business_key for update;
  if parent_status <> 'draft' then raise exception 'Issued quote lines cannot be changed'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger quote_line_items_guard_history before insert or update or delete on public.quote_line_items
  for each row execute function public.guard_quote_item_history();

create function public.save_work_quote(target_business_id uuid, draft jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  quote_id_value uuid := (draft ->> 'id')::uuid;
  request_id uuid := (draft ->> 'jobRequestId')::uuid;
  target_client uuid := (draft ->> 'clientId')::uuid;
  service_site uuid := (draft ->> 'propertyId')::uuid;
  inline_details jsonb := nullif(draft -> 'inlineClient', 'null'::jsonb);
  issue_value date := (draft ->> 'issueDate')::date;
  expiry_value date;
  title_value text := nullif(btrim(draft ->> 'scope'), '');
  notes_value text := nullif(btrim(draft ->> 'clientNotes'), '');
  private_value text := nullif(btrim(draft ->> 'internalNotes'), '');
  terms_value text := btrim(draft ->> 'terms');
  reference_value text := nullif(btrim(draft ->> 'reference'), '');
  items_value jsonb := draft -> 'items';
  request_row public.job_requests;
  current_quote public.quotes;
begin
  if not public.can_manage_business(target_business_id) then
    raise exception 'Only managers can save quotes' using errcode = '42501';
  end if;
  if num_nonnulls(request_id, target_client, inline_details) <> 1
     or (target_client is null and service_site is not null) then
    raise exception 'Choose one client or job request';
  end if;

  if quote_id_value is not null then
    select * into current_quote from public.quotes
      where id = quote_id_value and business_id = target_business_id for update;
    if not found or current_quote.status <> 'draft' then
      raise exception 'Only draft quotes can be edited';
    end if;
    if current_quote.updated_at is distinct from (draft ->> 'updatedAt')::timestamptz then
      raise exception 'This draft changed after it was opened. Reload the quote and try again.';
    end if;
    if current_quote.job_request_id is not null and request_id is distinct from current_quote.job_request_id then
      raise exception 'A draft linked to a request must keep that request';
    end if;
  end if;

  if request_id is not null then
    select * into request_row from public.job_requests
      where id = request_id and business_id = target_business_id;
    if not found or request_row.client_id is null or
      (request_row.status in ('closed', 'rejected') and current_quote.job_request_id is distinct from request_id) then
      raise exception 'Choose an open job request with a client';
    end if;
    target_client := request_row.client_id;
    service_site := request_row.service_address_id;
  elsif inline_details is not null then
    select c.client_id, c.address_id into target_client, service_site
      from public.create_inline_work_client(target_business_id, inline_details) c;
  end if;
  if not exists (
    select 1 from public.clients where id = target_client and business_id = target_business_id
      and (archived_at is null or target_client = current_quote.client_id)
  ) or (service_site is not null and not exists (
    select 1 from public.client_addresses where id = service_site and client_id = target_client
      and business_id = target_business_id and kind = 'service' and (is_active or id = current_quote.service_address_id)
  )) then
    raise exception 'Choose a service address belonging to this client';
  end if;
  if title_value is null or char_length(title_value) > 20000 or char_length(notes_value) > 20000
     or char_length(private_value) > 20000 or char_length(terms_value) > 20000 or char_length(reference_value) > 200 then
    raise exception 'Check the quote fields';
  end if;
  if jsonb_typeof(items_value) is distinct from 'array' or jsonb_array_length(items_value) not between 1 and 100 then
    raise exception 'Add at least one quote line item';
  end if;
  issue_value := coalesce(issue_value, current_quote.issue_date, (now() at time zone 'Australia/Brisbane')::date);
  expiry_value := case when draft ? 'validUntil' then (draft ->> 'validUntil')::date
    when quote_id_value is not null then current_quote.valid_until else issue_value + 14 end;
  if expiry_value < issue_value then raise exception 'Expiry must be on or after the issue date'; end if;

  if quote_id_value is null then
    insert into public.quotes (
      business_id, client_id, service_address_id, job_request_id, title, issue_date, valid_until,
      customer_reference, customer_message, terms_text, internal_notes, created_by
    ) values (
      target_business_id, target_client, service_site, request_id, title_value, issue_value, expiry_value,
      reference_value, notes_value, terms_value, private_value, auth.uid()
    ) returning id into quote_id_value;
  else
    update public.quotes set client_id = target_client, service_address_id = service_site, job_request_id = request_id,
      title = title_value, issue_date = issue_value, valid_until = expiry_value, customer_message = notes_value,
      internal_notes = private_value, customer_reference = case when draft ? 'reference' then reference_value else customer_reference end,
      terms_text = case when draft ? 'terms' then terms_value else terms_text end
      where id = quote_id_value and business_id = target_business_id;
    delete from public.quote_line_items where quote_id = quote_id_value and business_id = target_business_id;
  end if;

  if exists (
    select 1 from jsonb_array_elements(items_value) as entries(item)
    where coalesce(char_length(btrim(item ->> 'description')), 0) not between 1 and 1000
      or char_length(item ->> 'label') > 160 or char_length(item ->> 'unitLabel') > 32
      or coalesce((item ->> 'quantity')::numeric, 0) not between 0.001 and 100000
      or coalesce((item ->> 'rate')::numeric, -1) not between 0 and 10000000
  ) then raise exception 'Check the quote line items'; end if;

  insert into public.quote_line_items (business_id, quote_id, position, label, description, quantity, unit_label, unit_price, tax_rate)
  select target_business_id, quote_id_value, ordinal - 1, nullif(btrim(item ->> 'label'), ''),
    btrim(item ->> 'description'), (item ->> 'quantity')::numeric,
    coalesce(nullif(btrim(item ->> 'unitLabel'), ''), 'item'), (item ->> 'rate')::numeric, 0
  from jsonb_array_elements(items_value) with ordinality entries(item, ordinal);

  return quote_id_value;
end;
$$;

create function public.revise_work_quote(target_business_id uuid, target_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  original public.quotes;
  revision_id uuid;
  new_issue date := (now() at time zone 'Australia/Brisbane')::date;
begin
  if not public.can_manage_business(target_business_id) then
    raise exception 'Only managers can revise quotes' using errcode = '42501';
  end if;

  select * into original from public.quotes
    where id = target_quote_id and business_id = target_business_id for update;
  if not found or original.status = 'draft' then raise exception 'Choose an issued quote to revise'; end if;
  select id into revision_id from public.quotes
    where business_id = target_business_id and revision_of_quote_id = original.id and status = 'draft'
    order by created_at desc, id limit 1;
  if revision_id is not null then return revision_id; end if;

  insert into public.quotes (business_id, client_id, client_contact_id, service_address_id, job_request_id, template_id,
    revision_of_quote_id, title, issue_date, valid_until, customer_reference, customer_message, terms_text, internal_notes, created_by)
  values (target_business_id, original.client_id, original.client_contact_id, original.service_address_id, original.job_request_id,
    original.template_id, original.id, original.title, new_issue, new_issue + (original.valid_until - original.issue_date),
    original.customer_reference, original.customer_message, original.terms_text, original.internal_notes, auth.uid())
  returning id into revision_id;

  insert into public.quote_line_items (business_id, quote_id, position, label, description, quantity, unit_label, unit_price, tax_rate)
  select business_id, revision_id, position, label, description, quantity, unit_label, unit_price, tax_rate
    from public.quote_line_items where quote_id = original.id and business_id = target_business_id;
  return revision_id;
end;
$$;

revoke all on function public.work_quote_snapshot(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.guard_quote_history() from public, anon, authenticated;
revoke all on function public.guard_quote_item_history() from public, anon, authenticated;
revoke all on function public.save_work_quote(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.revise_work_quote(uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_work_quote(uuid, jsonb) to authenticated;
grant execute on function public.revise_work_quote(uuid, uuid) to authenticated;

commit;
