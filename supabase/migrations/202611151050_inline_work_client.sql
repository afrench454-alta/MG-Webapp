begin;

create function public.inline_customer_phone_key(value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when digits like '61%' and char_length(digits) >= 11 then '0' || substr(digits, 3)
    when char_length(digits) = 9 then '0' || digits else nullif(digits, '') end
  from (select regexp_replace(coalesce(value, ''), '[^0-9]', '', 'g') as digits) normalized;
$$;

create function public.create_inline_work_client(target_business_id uuid, client_details jsonb)
returns table(client_id uuid, address_id uuid)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  client_name text := nullif(btrim(client_details ->> 'name'), '');
  phone_value text := nullif(btrim(client_details ->> 'phone'), '');
  email_value text := nullif(lower(btrim(client_details ->> 'email')), '');
  site_value text := nullif(btrim(client_details ->> 'siteAddress'), '');
  phone_key text := public.inline_customer_phone_key(phone_value);
  matches uuid[];
begin
  if not public.can_manage_business(target_business_id) then
    raise exception 'Only managers can create clients' using errcode = '42501';
  end if;

  if client_name is null or char_length(client_name) > 200
     or char_length(phone_value) > 80 or char_length(email_value) > 254
     or char_length(site_value) > 500
     or (email_value is not null and email_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$') then
    raise exception 'Check the new client details';
  end if;

  if email_value is not null or phone_key is not null then
    -- Serialize inline contact matching per business so overlapping calls reuse an existing client.
    perform pg_advisory_xact_lock(hashtextextended('inline-work-client:' || target_business_id::text, 0));
    select array_agg(c.id) into matches from public.clients c
      where c.business_id = target_business_id and c.archived_at is null
        and (lower(btrim(c.email)) = email_value or public.inline_customer_phone_key(c.phone) = phone_key);
    if cardinality(matches) > 1 then
      raise exception 'More than one client has these contact details. Choose an existing client.';
    end if;
    client_id := matches[1];
  end if;

  if client_id is null then
    insert into public.clients (business_id, display_name, phone, email, lifecycle_status, preferred_contact, created_by)
    values (target_business_id, client_name, phone_value, email_value, 'active',
      case when email_value is null and phone_value is not null then 'phone' else 'email' end::public.preferred_contact_method, auth.uid())
    returning id into client_id;
  end if;

  if site_value is not null then
    select a.id into address_id from public.client_addresses a
      where a.business_id = target_business_id and a.client_id = create_inline_work_client.client_id
        and a.kind = 'service' and a.is_active and lower(btrim(a.line_1)) = lower(site_value)
      order by a.is_primary desc, a.created_at, a.id limit 1;
    if address_id is null then
      insert into public.client_addresses (business_id, client_id, kind, line_1, is_primary, is_active)
      values (target_business_id, client_id, 'service', site_value, not exists (
        select 1 from public.client_addresses a where a.business_id = target_business_id
          and a.client_id = create_inline_work_client.client_id and a.kind = 'service' and a.is_primary
      ), true)
      returning id into address_id;
    end if;
  end if;

  return next;
end;
$$;

revoke all on function public.create_inline_work_client(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.inline_customer_phone_key(text) from public, anon, authenticated;

commit;
