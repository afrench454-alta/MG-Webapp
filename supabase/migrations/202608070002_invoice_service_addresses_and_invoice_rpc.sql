create table public.invoice_service_addresses (
  business_id uuid not null,
  invoice_id uuid not null,
  client_address_id uuid not null,
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  primary key (invoice_id, client_address_id),
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete cascade,
  foreign key (client_address_id, business_id) references public.client_addresses (id, business_id) on delete restrict
);

create index invoice_service_addresses_business_invoice_idx
  on public.invoice_service_addresses (business_id, invoice_id, position);

alter table public.invoice_service_addresses enable row level security;

create policy invoice_service_addresses_manage_managers
on public.invoice_service_addresses for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create or replace function public.create_invoice_with_details(
  target_client_id uuid,
  primary_address_id uuid,
  service_address_ids uuid[],
  target_job_id uuid,
  due_days integer,
  invoice_notes text,
  invoice_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  actor_business_id uuid;
  actor_user_id uuid;
  normalized_address_ids uuid[];
  distinct_address_count integer;
  matched_address_count integer;
  created_invoice_id uuid;
begin
  actor_business_id := public.current_business_id();
  actor_user_id := auth.uid();

  if actor_business_id is null or actor_user_id is null then
    raise exception 'You must be signed in to create an invoice.';
  end if;

  if not public.can_manage_business(actor_business_id) then
    raise exception 'You do not have permission to create invoices for this business.';
  end if;

  if primary_address_id is null then
    raise exception 'A primary property address is required.';
  end if;

  normalized_address_ids := array_prepend(primary_address_id, array_remove(coalesce(service_address_ids, '{}'::uuid[]), primary_address_id));

  if array_length(normalized_address_ids, 1) is null then
    raise exception 'At least one property address is required.';
  end if;

  select count(*)
  into distinct_address_count
  from (
    select distinct requested.address_id
    from unnest(normalized_address_ids) as requested(address_id)
  ) deduped;

  select count(*)
  into matched_address_count
  from public.client_addresses addresses
  where addresses.business_id = actor_business_id
    and addresses.client_id = target_client_id
    and addresses.id in (
      select distinct requested.address_id
      from unnest(normalized_address_ids) as requested(address_id)
    );

  if matched_address_count <> distinct_address_count then
    raise exception 'One or more selected invoice properties are no longer available.';
  end if;

  if jsonb_typeof(invoice_items) <> 'array' or jsonb_array_length(invoice_items) = 0 then
    raise exception 'At least one invoice line item is required.';
  end if;

  insert into public.invoices (
    business_id,
    client_id,
    billing_address_id,
    job_id,
    document_status,
    payment_status,
    title,
    issue_date,
    due_date,
    payment_instructions,
    created_by
  ) values (
    actor_business_id,
    target_client_id,
    primary_address_id,
    target_job_id,
    'draft',
    'unpaid',
    'Invoice',
    current_date,
    current_date + greatest(due_days, 0),
    nullif(btrim(invoice_notes), ''),
    actor_user_id
  )
  returning id into created_invoice_id;

  insert into public.invoice_service_addresses (
    business_id,
    invoice_id,
    client_address_id,
    position
  )
  select
    actor_business_id,
    created_invoice_id,
    deduped.address_id,
    deduped.position
  from (
    select distinct on (requested.address_id)
      requested.address_id,
      requested.ordinality - 1 as position
    from unnest(normalized_address_ids) with ordinality as requested(address_id, ordinality)
    order by requested.address_id, requested.ordinality
  ) deduped
  order by deduped.position;

  insert into public.invoice_line_items (
    business_id,
    invoice_id,
    position,
    description,
    quantity,
    unit_price,
    tax_rate
  )
  select
    actor_business_id,
    created_invoice_id,
    item.ordinality - 1,
    trim(coalesce(item.payload ->> 'description', '')),
    coalesce((item.payload ->> 'quantity')::numeric, 0),
    coalesce((item.payload ->> 'rate')::numeric, 0),
    0
  from jsonb_array_elements(invoice_items) with ordinality as item(payload, ordinality);

  if exists (
    select 1
    from public.invoice_line_items line_items
    where line_items.invoice_id = created_invoice_id
      and (
        char_length(btrim(line_items.description)) = 0
        or line_items.quantity <= 0
        or line_items.unit_price < 0
      )
  ) then
    raise exception 'Invoice line items must include a description, positive quantity, and non-negative rate.';
  end if;

  return created_invoice_id;
end;
$$;

grant select, insert, update, delete on table public.invoice_service_addresses to authenticated;

revoke all on function public.create_invoice_with_details(uuid, uuid, uuid[], uuid, integer, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.create_invoice_with_details(uuid, uuid, uuid[], uuid, integer, text, jsonb)
  to authenticated;
