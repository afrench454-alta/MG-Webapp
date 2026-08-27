begin;

create or replace function public.save_client_with_details(
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
  email_value := nullif(lower(btrim(coalesce(client_payload ->> 'email', ''))), '');
  phone_value := nullif(btrim(coalesce(client_payload ->> 'phone', '')), '');
  notes_value := nullif(btrim(coalesce(client_payload ->> 'notes', '')), '');
  lifecycle_text := lower(
    coalesce(nullif(btrim(client_payload ->> 'status'), ''), 'lead')
  );
  preferred_text := lower(
    coalesce(nullif(btrim(client_payload ->> 'preferred'), ''), 'phone')
  );

  if char_length(display_name_value) not between 1 and 200 then
    raise exception 'Client name must be between 1 and 200 characters';
  end if;

  if phone_value is null or char_length(phone_value) not between 3 and 80 then
    raise exception 'A valid client phone number is required';
  end if;

  if email_value is not null and (
       char_length(email_value) not between 3 and 320
       or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     ) then
    raise exception 'Enter a valid client email';
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
    where id = primary_contact_id;
  end if;

  for property_item, property_position in
    select value, (ordinality - 1)
    from jsonb_array_elements(properties_payload) with ordinality
  loop
    if jsonb_typeof(property_item) <> 'object' then
      raise exception 'Each client property must be a JSON object';
    end if;

    property_address := btrim(coalesce(property_item ->> 'address', ''));
    if char_length(property_address) < 1 or char_length(property_address) > 500 then
      raise exception 'Property address must be between 1 and 500 characters';
    end if;

    property_label := nullif(btrim(coalesce(property_item ->> 'name', '')), '');
    if property_label is not null and char_length(property_label) > 160 then
      raise exception 'Property name must not exceed 160 characters';
    end if;

    property_cadence := nullif(btrim(coalesce(property_item ->> 'cadence', '')), '');
    if property_cadence is not null and char_length(property_cadence) > 120 then
      raise exception 'Property cadence must not exceed 120 characters';
    end if;

    property_id_text := nullif(btrim(coalesce(property_item ->> 'id', '')), '');
    property_id := null;

    if property_id_text is not null and property_id_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      property_id := property_id_text::uuid;
    end if;

    if property_id is not null then
      update public.client_addresses
      set
        label = property_label,
        line_1 = property_address,
        service_cadence = property_cadence,
        is_active = true,
        is_primary = (active_property_position = 0)
      where id = property_id
        and client_id = saved_client_id
        and business_id = target_business_id
      returning id into property_id;
    end if;

    if property_id is null then
      insert into public.client_addresses (
        business_id,
        client_id,
        kind,
        label,
        line_1,
        service_cadence,
        is_primary,
        is_active
      )
      values (
        target_business_id,
        saved_client_id,
        'service',
        property_label,
        property_address,
        property_cadence,
        (active_property_position = 0),
        true
      )
      returning id into property_id;
    end if;

    active_property_position := active_property_position + 1;
    retained_address_ids := array_append(retained_address_ids, property_id);
  end loop;

  update public.client_addresses
  set
    is_active = false,
    is_primary = false
  where client_id = saved_client_id
    and business_id = target_business_id
    and kind = 'service'
    and not (id = any(retained_address_ids));

  return saved_client_id;
end;
$$;

revoke all on function public.save_client_with_details(jsonb, uuid)
  from public, anon, authenticated;

grant execute on function public.save_client_with_details(jsonb, uuid)
  to authenticated;

comment on function public.save_client_with_details(jsonb, uuid) is
  'Atomically saves a client, primary contact (with required phone and optional email), and active service-address set for the authenticated owner or co-owner.';

commit;
