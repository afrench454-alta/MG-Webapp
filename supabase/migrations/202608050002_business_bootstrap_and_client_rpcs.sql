begin;

create type public.client_lifecycle_status as enum ('lead', 'active', 'inactive');
create type public.preferred_contact_method as enum ('email', 'phone', 'sms');

alter table public.clients
  add column lifecycle_status public.client_lifecycle_status not null default 'lead',
  add column preferred_contact public.preferred_contact_method not null default 'email',
  add column archived_at timestamptz;

update public.clients
set lifecycle_status = 'inactive'
where not is_active;

alter table public.client_addresses
  add column service_cadence text
    check (
      service_cadence is null
      or char_length(btrim(service_cadence)) between 1 and 120
    ),
  add column is_active boolean not null default true;

create index clients_business_active_name_idx
  on public.clients (business_id, display_name)
  where archived_at is null;

create index client_addresses_active_service_idx
  on public.client_addresses (business_id, client_id, is_primary desc, created_at)
  where kind = 'service' and is_active;

create function public.bootstrap_current_user_business(
  desired_name text default null
)
returns table (
  business_id uuid,
  business_name text,
  member_role public.app_role
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  requested_name text;
  existing_is_active boolean;
begin
  if actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- Serialise first-run provisioning for this auth user.
  perform pg_advisory_xact_lock(hashtextextended(actor_user_id::text, 0));

  select p.business_id, b.name, p.role, p.is_active
  into business_id, business_name, member_role, existing_is_active
  from public.profiles p
  join public.businesses b on b.id = p.business_id
  where p.id = actor_user_id
  limit 1;

  if found then
    if not existing_is_active then
      raise exception 'This FieldCentral membership is inactive';
    end if;
    return next;
    return;
  end if;

  requested_name := coalesce(
    nullif(btrim(desired_name), ''),
    'My Field Service Business'
  );

  if char_length(requested_name) > 160 then
    raise exception 'Business name must not exceed 160 characters';
  end if;

  insert into public.businesses (owner_user_id, name, email)
  values (
    actor_user_id,
    requested_name,
    nullif(btrim(auth.jwt() ->> 'email'), '')
  )
  returning id, name into business_id, business_name;

  member_role := 'owner';
  return next;
end;
$$;

create function public.save_client_with_details(
  client_payload jsonb,
  target_client_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  target_business_id uuid;
  saved_client_id uuid;
  display_name_value text;
  email_value text;
  phone_value text;
  notes_value text;
  lifecycle_text text;
  lifecycle_value public.client_lifecycle_status;
  preferred_text text;
  preferred_value public.preferred_contact_method;
  properties_payload jsonb;
  property_item jsonb;
  property_position bigint;
  property_id uuid;
  property_id_text text;
  property_label text;
  property_address text;
  property_cadence text;
  active_property_position integer := 0;
  retained_address_ids uuid[] := '{}'::uuid[];
  primary_contact_id uuid;
begin
  if actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  target_business_id := public.current_business_id();

  if target_business_id is null
     or not public.can_manage_business(target_business_id) then
    raise exception 'Owner or co-owner access is required';
  end if;

  if client_payload is null or jsonb_typeof(client_payload) <> 'object' then
    raise exception 'Client payload must be a JSON object';
  end if;

  if pg_column_size(client_payload) > 262144 then
    raise exception 'Client payload exceeds the 256 KB limit';
  end if;

  display_name_value := btrim(coalesce(client_payload ->> 'name', ''));
  email_value := lower(btrim(coalesce(client_payload ->> 'email', '')));
  phone_value := nullif(btrim(coalesce(client_payload ->> 'phone', '')), '');
  notes_value := nullif(btrim(coalesce(client_payload ->> 'notes', '')), '');
  lifecycle_text := lower(
    coalesce(nullif(btrim(client_payload ->> 'status'), ''), 'lead')
  );
  preferred_text := lower(
    coalesce(nullif(btrim(client_payload ->> 'preferred'), ''), 'email')
  );

  if char_length(display_name_value) not between 1 and 200 then
    raise exception 'Client name must be between 1 and 200 characters';
  end if;

  if char_length(email_value) not between 3 and 320
     or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid client email is required';
  end if;

  if phone_value is not null and char_length(phone_value) > 80 then
    raise exception 'Client phone must not exceed 80 characters';
  end if;

  if notes_value is not null and char_length(notes_value) > 20000 then
    raise exception 'Client notes must not exceed 20000 characters';
  end if;

  if lifecycle_text not in ('lead', 'active', 'inactive') then
    raise exception 'Client status must be lead, active, or inactive';
  end if;
  lifecycle_value := lifecycle_text::public.client_lifecycle_status;

  if preferred_text not in ('email', 'phone', 'sms') then
    raise exception 'Preferred contact must be email, phone, or sms';
  end if;
  preferred_value := preferred_text::public.preferred_contact_method;

  properties_payload := coalesce(client_payload -> 'properties', '[]'::jsonb);

  if jsonb_typeof(properties_payload) <> 'array' then
    raise exception 'Client properties must be a JSON array';
  end if;

  if jsonb_array_length(properties_payload) > 50 then
    raise exception 'A client may have at most 50 service properties';
  end if;

  if target_client_id is null then
    insert into public.clients (
      business_id,
      display_name,
      email,
      phone,
      notes,
      lifecycle_status,
      preferred_contact,
      is_active,
      created_by
    )
    values (
      target_business_id,
      display_name_value,
      email_value,
      phone_value,
      notes_value,
      lifecycle_value,
      preferred_value,
      lifecycle_value <> 'inactive',
      actor_user_id
    )
    returning id into saved_client_id;
  else
    update public.clients
    set
      display_name = display_name_value,
      email = email_value,
      phone = phone_value,
      notes = notes_value,
      lifecycle_status = lifecycle_value,
      preferred_contact = preferred_value,
      is_active = lifecycle_value <> 'inactive',
      archived_at = null
    where id = target_client_id
      and business_id = target_business_id
    returning id into saved_client_id;

    if saved_client_id is null then
      raise exception 'Client not found';
    end if;
  end if;

  select cc.id
  into primary_contact_id
  from public.client_contacts cc
  where cc.business_id = target_business_id
    and cc.client_id = saved_client_id
    and cc.is_primary
  for update
  limit 1;

  if primary_contact_id is null then
    insert into public.client_contacts (
      business_id,
      client_id,
      full_name,
      email,
      phone,
      is_primary
    )
    values (
      target_business_id,
      saved_client_id,
      display_name_value,
      email_value,
      phone_value,
      true
    );
  else
    update public.client_contacts
    set
      full_name = display_name_value,
      email = email_value,
      phone = phone_value
    where id = primary_contact_id
      and business_id = target_business_id;
  end if;

  update public.client_addresses
  set is_primary = false
  where business_id = target_business_id
    and client_id = saved_client_id
    and kind = 'service'
    and is_primary;

  for property_item, property_position in
    select item, ordinality
    from jsonb_array_elements(properties_payload)
      with ordinality as properties(item, ordinality)
  loop
    if jsonb_typeof(property_item) <> 'object' then
      raise exception 'Every client property must be a JSON object';
    end if;

    property_label := btrim(coalesce(property_item ->> 'name', ''));
    property_address := btrim(coalesce(property_item ->> 'address', ''));
    property_cadence := coalesce(
      nullif(btrim(property_item ->> 'cadence'), ''),
      'One-off'
    );

    if property_label = '' and property_address = '' then
      continue;
    end if;

    if property_address = '' or char_length(property_address) > 500 then
      raise exception 'Every property requires an address of at most 500 characters';
    end if;

    if property_label = '' then
      property_label := format('Property %s', property_position);
    end if;

    if char_length(property_label) > 160 then
      raise exception 'Property name must not exceed 160 characters';
    end if;

    if char_length(property_cadence) > 120 then
      raise exception 'Property cadence must not exceed 120 characters';
    end if;

    active_property_position := active_property_position + 1;
    property_id_text := nullif(btrim(property_item ->> 'id'), '');
    property_id := null;

    if property_id_text is not null then
      begin
        property_id := property_id_text::uuid;
      exception when invalid_text_representation then
        raise exception 'Property id must be a valid UUID';
      end;

      update public.client_addresses
      set
        label = property_label,
        line_1 = property_address,
        service_cadence = property_cadence,
        is_active = true,
        is_primary = active_property_position = 1
      where id = property_id
        and business_id = target_business_id
        and client_id = saved_client_id
        and kind = 'service';

      if not found then
        raise exception 'Property not found for this client';
      end if;
    else
      insert into public.client_addresses (
        business_id,
        client_id,
        kind,
        label,
        line_1,
        service_cadence,
        is_active,
        is_primary
      )
      values (
        target_business_id,
        saved_client_id,
        'service',
        property_label,
        property_address,
        property_cadence,
        true,
        active_property_position = 1
      )
      returning id into property_id;
    end if;

    retained_address_ids := array_append(retained_address_ids, property_id);
  end loop;

  update public.client_addresses
  set
    is_active = false,
    is_primary = false
  where business_id = target_business_id
    and client_id = saved_client_id
    and kind = 'service'
    and not (id = any(retained_address_ids))
    and (is_active or is_primary);

  return saved_client_id;
end;
$$;

create function public.archive_client(target_client_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_business_id uuid;
  archived_client_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  target_business_id := public.current_business_id();

  if target_business_id is null
     or not public.can_manage_business(target_business_id) then
    raise exception 'Owner or co-owner access is required';
  end if;

  update public.clients
  set
    lifecycle_status = 'inactive',
    is_active = false,
    archived_at = coalesce(archived_at, now())
  where id = target_client_id
    and business_id = target_business_id
  returning id into archived_client_id;

  if archived_client_id is null then
    raise exception 'Client not found';
  end if;

  return archived_client_id;
end;
$$;

create trigger client_contacts_audit
after insert or update or delete on public.client_contacts
for each row execute function public.audit_row_change();

create trigger client_addresses_audit
after insert or update or delete on public.client_addresses
for each row execute function public.audit_row_change();

revoke delete on table public.clients from authenticated;

revoke all on function public.bootstrap_current_user_business(text)
  from public, anon, authenticated;
revoke all on function public.save_client_with_details(jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.archive_client(uuid)
  from public, anon, authenticated;

grant execute on function public.bootstrap_current_user_business(text)
  to authenticated;
grant execute on function public.save_client_with_details(jsonb, uuid)
  to authenticated;
grant execute on function public.archive_client(uuid)
  to authenticated;

comment on function public.bootstrap_current_user_business(text) is
  'Idempotently provisions the first authenticated owner business and returns the active database-backed membership.';
comment on function public.save_client_with_details(jsonb, uuid) is
  'Atomically saves a client, primary contact, and active service-address set for the authenticated owner or co-owner.';
comment on function public.archive_client(uuid) is
  'Recoverably removes a client from active work while preserving all historical foreign-key relationships.';

commit;
