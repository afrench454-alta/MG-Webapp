begin;

alter table public.job_requests
  add column previous_open_status public.job_request_status
    check (previous_open_status in ('new', 'qualified', 'quoting', 'scheduled'));

create function public.guard_job_request_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'closed' then
    new.previous_open_status := case
      when old.status in ('new', 'qualified', 'quoting', 'scheduled') then old.status
      else old.previous_open_status
    end;
  elsif old.status = 'closed' then
    new.status := coalesce(old.previous_open_status, case when exists (
      select 1 from public.jobs j where j.job_request_id = old.id
        and j.business_id = old.business_id and j.status = 'scheduled'
    ) then 'scheduled'::public.job_request_status else 'qualified'::public.job_request_status end);
    new.previous_open_status := null;
  else
    new.previous_open_status := null;
  end if;
  return new;
end;
$$;

create trigger job_requests_guard_stage
  before update of status, previous_open_status on public.job_requests
  for each row execute function public.guard_job_request_stage();

create function public.set_work_request_closed(target_business_id uuid, target_request_id uuid, is_closed boolean)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.can_manage_business(target_business_id) then
    raise exception 'Only managers can close or reopen job requests' using errcode = '42501';
  end if;

  update public.job_requests
  set status = case when is_closed then 'closed'::public.job_request_status
    when status = 'closed' then 'qualified'::public.job_request_status else status end
  where id = target_request_id and business_id = target_business_id
    and status <> 'rejected' and is_closed is not null;

  if not found then raise exception 'This job request cannot be updated'; end if;
  return target_request_id;
end;
$$;

-- Retain intake and its existing quotation/job links when an operator closes work.
drop policy job_requests_manage_managers on public.job_requests;
create policy job_requests_read_managers on public.job_requests for select to authenticated
  using (public.can_manage_business(business_id));
create policy job_requests_insert_managers on public.job_requests for insert to authenticated
  with check (public.can_manage_business(business_id));
create policy job_requests_update_managers on public.job_requests for update to authenticated
  using (public.can_manage_business(business_id)) with check (public.can_manage_business(business_id));

revoke all on function public.guard_job_request_stage() from public, anon, authenticated;
revoke all on function public.set_work_request_closed(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_work_request_closed(uuid, uuid, boolean) to authenticated;

create function public.schedule_work_job(target_business_id uuid, draft jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid := (draft ->> 'jobRequestId')::uuid;
  target_client uuid := (draft ->> 'clientId')::uuid;
  service_site uuid := (draft ->> 'propertyId')::uuid;
  inline_details jsonb := nullif(draft -> 'inlineClient', 'null'::jsonb);
  start_time timestamptz := (draft ->> 'scheduledStart')::timestamptz;
  title_value text := nullif(btrim(draft ->> 'category'), '');
  scope_value text := nullif(btrim(draft ->> 'scope'), '');
  profile_ids uuid[];
  request_row public.job_requests;
  job_id uuid;
begin
  if not public.can_manage_business(target_business_id) then
    raise exception 'Only managers can schedule jobs' using errcode = '42501';
  end if;
  if num_nonnulls(request_id, target_client, inline_details) <> 1
     or (target_client is null and service_site is not null) or start_time is null then
    raise exception 'Choose one client or job request and a start time';
  end if;

  if request_id is not null then
    select * into request_row from public.job_requests
      where id = request_id and business_id = target_business_id for update;
    if not found or request_row.status in ('closed', 'rejected') then
      raise exception 'Choose an open job request';
    end if;
    target_client := request_row.client_id;
    service_site := request_row.service_address_id;
    title_value := request_row.title;
    scope_value := request_row.description;
  elsif inline_details is not null then
    select c.client_id, c.address_id into target_client, service_site
    from public.create_inline_work_client(target_business_id, inline_details) c;
  end if;

  if not exists (
    select 1 from public.client_addresses a join public.clients c
      on a.client_id = c.id and a.business_id = c.business_id
    where a.id = service_site and a.client_id = target_client and a.business_id = target_business_id
      and a.kind = 'service' and a.is_active and c.archived_at is null
  ) then
    raise exception 'Choose an active service address belonging to this client';
  end if;
  if title_value is null or char_length(title_value) > 220 or char_length(scope_value) > 20000 then
    raise exception 'Check the job service and scope';
  end if;

  select array_agg(a.profile_id order by a.first_position) into profile_ids
  from (
    select value::uuid as profile_id, min(position) as first_position
    from jsonb_array_elements_text(coalesce(nullif(draft -> 'profileIds', 'null'::jsonb), '[]')) with ordinality as entries(value, position)
    group by value::uuid
  ) a;
  if cardinality(profile_ids) > 50 or (
    select count(*) from public.profiles
    where id = any(profile_ids) and business_id = target_business_id and is_active
  ) <> coalesce(cardinality(profile_ids), 0) then
    raise exception 'One or more selected team members are unavailable';
  end if;

  insert into public.jobs (
    business_id, client_id, service_address_id, job_request_id, status, title, scope_of_work,
    scheduled_start, scheduled_end, created_by
  ) values (
    target_business_id, target_client, service_site, request_id, 'scheduled', title_value, scope_value,
    start_time, start_time + interval '1 hour', auth.uid()
  ) returning id into job_id;

  insert into public.job_assignments (business_id, job_id, profile_id, is_lead, assigned_by)
  select target_business_id, job_id, a.id, a.position = 1, auth.uid()
    from unnest(profile_ids) with ordinality a(id, position);

  if request_id is not null then
    update public.job_requests set status = 'scheduled'
      where id = request_id and business_id = target_business_id;
  end if;
  return job_id;
end;
$$;

revoke all on function public.schedule_work_job(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.schedule_work_job(uuid, jsonb) to authenticated;

create function public.save_work_request(target_business_id uuid, draft jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_client uuid := (draft ->> 'clientId')::uuid;
  target_site uuid := (draft ->> 'propertyId')::uuid;
  response_id uuid := (draft ->> 'questionnaireResponseId')::uuid;
  inline_details jsonb := nullif(draft -> 'inlineClient', 'null'::jsonb);
  title_value text := nullif(btrim(draft ->> 'title'), '');
  scope_value text := nullif(btrim(draft ->> 'scope'), '');
  chosen_site public.client_addresses%rowtype;
  saved_id uuid;
begin
  if not public.can_manage_business(target_business_id) then
    raise exception 'Only managers can save job requests' using errcode = '42501';
  end if;
  if num_nonnulls(target_client, inline_details) <> 1 or (target_client is null and target_site is not null)
    or title_value is null or char_length(title_value) > 220 or scope_value is null or char_length(scope_value) > 20000 then
    raise exception 'Check the job request details';
  end if;
  if inline_details is not null then
    select c.client_id, c.address_id into target_client, target_site
      from public.create_inline_work_client(target_business_id, inline_details) c;
  end if;
  select a.* into chosen_site from public.client_addresses a
    join public.clients c on a.client_id = c.id and a.business_id = c.business_id
    where a.id = target_site and a.client_id = target_client and a.business_id = target_business_id
      and a.kind = 'service' and a.is_active and c.archived_at is null;
  if not found then raise exception 'Choose an active service address belonging to this client'; end if;
  if response_id is not null and not exists (
    select 1 from public.questionnaire_responses where id = response_id and business_id = target_business_id
  ) then raise exception 'Choose a questionnaire response from your business'; end if;

  insert into public.job_requests (business_id, client_id, service_address_id, title, description, source,
    questionnaire_response_id, created_by, service_address_snapshot)
  values (target_business_id, target_client, target_site, title_value, scope_value,
    case when response_id is null then 'manual' else 'questionnaire' end, response_id, auth.uid(),
    jsonb_build_object('label', chosen_site.label, 'line_1', chosen_site.line_1))
  returning id into saved_id;
  return saved_id;
end;
$$;

revoke all on function public.save_work_request(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_work_request(uuid, jsonb) to authenticated;
commit;
