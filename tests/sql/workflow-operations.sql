begin;

do $$
declare
  company constant uuid := 'a2000000-0000-4000-8000-000000000001';
  other_company constant uuid := 'a2000000-0000-4000-8000-000000000002';
  owner_actor constant uuid := 'a2000000-0000-4000-8000-000000000003';
  other_owner constant uuid := 'a2000000-0000-4000-8000-000000000004';
  assigned_actor constant uuid := 'a2000000-0000-4000-8000-000000000005';
  unassigned_actor constant uuid := 'a2000000-0000-4000-8000-000000000006';
  note_id constant uuid := 'a2000000-0000-4000-8000-000000000007';
  crew uuid[] := array[assigned_actor];
  request_id uuid;
  legacy_request_id uuid;
  job_id_value uuid;
  next_job_value uuid;
  worker_job_id uuid;
  quote_id_value uuid;
  revised_id uuid;
  revision_version timestamptz;
  client_id_value uuid;
  canonical_site uuid;
  normal_items jsonb := '[{"description":"Weekly edging", "label":"Edging", "quantity":1.25, "rate":80, "unitLabel":"hours"}]';
  direct_visit jsonb := '{"category":"Yard Services","scope":"Edge the driveway","scheduledStart":"2026-11-20T09:00:00+10:00"}';
  quote_input jsonb := '{"scope":"Edge the driveway","issueDate":"2026-11-18","validUntil":"2026-12-17","reference":"SITE-112","terms":"Synthetic terms","clientNotes":"Customer notes","internalNotes":"Private sentinel"}';
begin
  insert into auth.users (id, email) values
    (owner_actor, 'workflow-owner@example.test'), (other_owner, 'workflow-other@example.test'),
    (assigned_actor, 'workflow-assigned@example.test'), (unassigned_actor, 'workflow-unassigned@example.test');
  insert into public.businesses (id, owner_user_id, name)
    values (company, owner_actor, 'Synthetic workshop'), (other_company, other_owner, 'Outside workshop');
  insert into public.profiles (id, business_id, role, display_name) values
    (owner_actor, company, 'owner', 'Workflow owner'),
    (other_owner, other_company, 'owner', 'Outside owner'),
    (assigned_actor, company, 'technician', 'Assigned worker'),
    (unassigned_actor, company, 'technician', 'Other worker')
    on conflict (id) do update set display_name = excluded.display_name;

  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', owner_actor::text, true);

  request_id := public.save_work_request(company,
    '{"title":"Yard Services","scope":"Trim hedges","inlineClient":{"name":"Synthetic client","email":"repeat-work@example.test","siteAddress":"10 Sample Rd"}}');
  select client_id, service_address_id into client_id_value, canonical_site from public.job_requests where id = request_id;
  if client_id_value is null or canonical_site is null then raise exception 'Inline request client or address missing'; end if;

  update public.job_requests set status = 'qualified' where id = request_id;
  perform public.set_work_request_closed(company, request_id, true);
  perform public.set_work_request_closed(company, request_id, true);
  if not exists (select 1 from public.job_requests where id = request_id and status = 'closed' and previous_open_status = 'qualified') then
    raise exception 'Closing twice lost the prior request stage';
  end if;
  perform public.set_work_request_closed(company, request_id, false);
  perform public.set_work_request_closed(company, request_id, false);
  if not exists (select 1 from public.job_requests where id = request_id and status = 'qualified' and client_id = client_id_value) then
    raise exception 'Reopening did not restore the prior request stage and client link';
  end if;

  insert into public.job_requests (business_id, client_id, service_address_id, status, title)
    values (company, client_id_value, canonical_site, 'closed', 'Legacy closed request')
    returning id into legacy_request_id;
  perform public.set_work_request_closed(company, legacy_request_id, false);
  if not exists (select 1 from public.job_requests where id = legacy_request_id and status = 'qualified') then
    raise exception 'A legacy closed request should reopen to Qualified';
  end if;

  begin
    perform public.schedule_work_job(company, direct_visit || jsonb_build_object(
      'inlineClient', jsonb_build_object('name', 'Rollback sample', 'siteAddress', '11 Sample Rd'),
      'profileIds', array[other_owner]
    ));
    raise exception 'Unexpected cross-tenant assignment success';
  exception when raise_exception then
    if sqlerrm not like 'One or more selected team members are unavailable%' then raise; end if;
  end;
  if exists (select 1 from public.clients where display_name = 'Rollback sample') then
    raise exception 'Inline client survived failed schedule write';
  end if;

  job_id_value := public.schedule_work_job(company, direct_visit || jsonb_build_object(
    'inlineClient', jsonb_build_object('name', 'Same existing client', 'email', 'REPEAT-WORK@example.test', 'siteAddress', '10 Sample Rd'),
    'profileIds', crew
  ));
  if not exists (select 1 from public.jobs where id = job_id_value and client_id = client_id_value
      and job_request_id is null and service_address_id = canonical_site) then
    raise exception 'Direct schedule did not reuse the unique client and did not preserve a null request link';
  end if;
  if not exists (select 1 from public.job_assignments where job_id = job_id_value and profile_id = assigned_actor and is_lead) then
    raise exception 'Scheduled crew or lead was not saved';
  end if;

  next_job_value := public.update_work_job(company, job_id_value, 'completed', 'Office instructions', 'weekly', 1, false, null);
  if next_job_value is null or not exists (select 1 from public.jobs
      where id = next_job_value and recurrence_parent_job_id = job_id_value and status = 'scheduled'
      and scheduled_start = '2026-11-27T09:00:00+10:00'::timestamptz) then
    raise exception 'Completing a scheduled job did not create the next visit';
  end if;
  if public.update_work_job(company, job_id_value, 'completed', 'Office instructions', 'weekly', 1, false, null) <> next_job_value
    or (select count(*) from public.jobs where recurrence_parent_job_id = job_id_value) <> 1 then
    raise exception 'Retry changed or duplicated the next occurrence';
  end if;
  begin
    update public.jobs set status = 'scheduled' where id = job_id_value;
    raise exception 'Unexpected terminal-status edit success';
  exception when raise_exception then
    if sqlerrm not like 'Completed or cancelled jobs cannot be moved%' then raise; end if;
  end;

  worker_job_id := public.schedule_work_job(company, direct_visit || jsonb_build_object('jobRequestId', request_id, 'profileIds', crew));
  if not exists (select 1 from public.job_requests where id = request_id and status = 'scheduled' and client_id = client_id_value) then
    raise exception 'Request scheduling lost intake context';
  end if;
  perform public.update_work_job(company, worker_job_id, 'scheduled', 'Office instructions', 'weekly', 1, false, null);
  perform set_config('request.jwt.claim.sub', assigned_actor::text, true);
  begin
    perform public.update_work_job(company, worker_job_id, 'completed', 'Forged instructions', null, null, false, null);
    raise exception 'Unexpected direct worker completion success';
  exception when raise_exception then
    if sqlerrm not like 'This job status transition is not available to technicians%' then raise; end if;
  end;
  perform public.update_work_job(company, worker_job_id, 'in_progress', 'Forged instructions', null, null, false, null);
  perform public.add_work_job_note(company, worker_job_id, note_id, 'Gate remained closed');
  perform public.add_work_job_note(company, worker_job_id, note_id, 'Gate remained closed');
  if (select count(*) from public.job_notes where job_id = worker_job_id and body = 'Gate remained closed'
    and not is_customer_visible) <> 1 then raise exception 'Field note did not remain private and idempotent'; end if;
  next_job_value := public.update_work_job(company, worker_job_id, 'completed', 'Forged instructions', null, null, false, null);
  if next_job_value is null or not exists (select 1 from public.jobs
      where id = worker_job_id and status = 'completed' and internal_instructions = 'Office instructions') then
    raise exception 'Assigned technician completion failed or altered manager instructions';
  end if;
  perform set_config('request.jwt.claim.sub', unassigned_actor::text, true);
  begin
    perform public.add_work_job_note(company, worker_job_id, gen_random_uuid(), 'Unauthorised note');
    raise exception 'Unexpected unassigned worker note success';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.update_work_job(company, worker_job_id, 'completed', '', null, null, false, null);
    raise exception 'Unexpected unassigned worker job update success';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claim.sub', owner_actor::text, true);
  quote_id_value := public.save_work_quote(company, quote_input || jsonb_build_object(
    'inlineClient', jsonb_build_object('name', 'Name only client'), 'items', normal_items));
  if not exists (select 1 from public.quotes q join public.clients c on c.id = q.client_id
    where q.id = quote_id_value and q.status = 'draft' and q.job_request_id is null and q.service_address_id is null
    and q.valid_until = '2026-12-17' and q.customer_reference = 'SITE-112' and c.display_name = 'Name only client') then
    raise exception 'Quote did not preserve direct inline identity, dates, and reference';
  end if;

  update public.quotes set status = 'approved' where id = quote_id_value;
  update public.clients set display_name = 'Renamed client' where id in (select client_id from public.quotes where id = quote_id_value);
  if not exists (select 1 from public.quotes where id = quote_id_value and
    issue_snapshot ->> 'client' = 'Name only client' and issue_snapshot -> 'issuer' ->> 'name' = 'Synthetic workshop') then
    raise exception 'Accepted quote lost its original snapshot';
  end if;
  begin
    update public.quote_line_items set unit_price = 99 where quote_id = quote_id_value;
    raise exception 'Unexpected direct accepted quote line edit success';
  exception when raise_exception then
    if sqlerrm not like 'Issued quote lines cannot be changed%' then raise; end if;
  end;
  begin
    update public.quotes set status = 'draft' where id = quote_id_value;
    raise exception 'Unexpected quote reopening success';
  exception when raise_exception then
    if sqlerrm not like 'This quote status change is unavailable%' then raise; end if;
  end;

  revised_id := public.revise_work_quote(company, quote_id_value);
  if revised_id is null or public.revise_work_quote(company, quote_id_value) <> revised_id
    or not exists (select 1 from public.quotes where id = revised_id and revision_of_quote_id = quote_id_value and status = 'draft') then
    raise exception 'Revision did not link to the accepted original or was duplicated';
  end if;
  select updated_at, client_id into revision_version, client_id_value from public.quotes where id = revised_id;
  begin
    perform public.save_work_quote(company, quote_input || jsonb_build_object(
      'id', revised_id, 'updatedAt', revision_version - interval '1 second', 'clientId', client_id_value, 'items', normal_items));
    raise exception 'Unexpected stale draft save success';
  exception when raise_exception then
    if sqlerrm not like 'This draft changed after it was opened%' then raise; end if;
  end;

  begin
    perform public.save_work_quote(company, quote_input || jsonb_build_object(
      'id', revised_id, 'updatedAt', revision_version, 'clientId', client_id_value,
      'items', '[{"description":"Broken line", "quantity":0, "rate":80}]'::jsonb));
    raise exception 'Unexpected invalid line save success';
  exception when raise_exception then
    if sqlerrm not like 'Check the quote line items%' then raise; end if;
  end;
  if not exists (select 1 from public.quote_line_items where quote_id = revised_id and label = 'Edging'
    and unit_label = 'hours' and quantity = 1.25 and unit_price = 80) then
    raise exception 'Failed quote edit did not preserve saved line item';
  end if;

  perform set_config('request.jwt.claim.sub', other_owner::text, true);
  begin
    perform public.revise_work_quote(company, quote_id_value);
    raise exception 'Unexpected cross-tenant quote revision success';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.update_work_job(company, job_id_value, 'completed', '', null, null, false, null);
    raise exception 'Unexpected cross-tenant job update success';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
