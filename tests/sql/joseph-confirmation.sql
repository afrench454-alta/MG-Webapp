-- Run as the local test database owner after migrations. All fixture data rolls back.
begin;

insert into auth.users (id, email) values
  ('ad111111-1111-4111-8111-111111111111', 'joseph-owner@example.test'),
  ('ad111111-1111-4111-8111-111111111112', 'joseph-co-owner@example.test'),
  ('ad111111-1111-4111-8111-111111111113', 'joseph-worker@example.test'),
  ('ad111111-1111-4111-8111-111111111114', 'joseph-other@example.test');

insert into public.businesses (id, owner_user_id, name) values
  ('ad222222-2222-4222-8222-222222222221', 'ad111111-1111-4111-8111-111111111111', 'Test Joseph tenant'),
  ('ad222222-2222-4222-8222-222222222222', 'ad111111-1111-4111-8111-111111111114', 'Test separate tenant');

insert into public.profiles (id, business_id, role) values
  ('ad111111-1111-4111-8111-111111111112', 'ad222222-2222-4222-8222-222222222221', 'co_owner'),
  ('ad111111-1111-4111-8111-111111111113', 'ad222222-2222-4222-8222-222222222221', 'technician');

insert into public.clients (id, business_id, display_name, phone) values
  ('ad333333-3333-4333-8333-333333333333', 'ad222222-2222-4222-8222-222222222221', 'Test Joseph customer', '+61 400 000 111');

insert into public.client_addresses (id, business_id, client_id, line_1) values
  ('ad444444-4444-4444-8444-444444444444', 'ad222222-2222-4222-8222-222222222221',
   'ad333333-3333-4333-8333-333333333333', '100 Test Street');

insert into public.job_requests (id, business_id, client_id, service_address_id, title) values
  ('ad555555-5555-4555-8555-555555555555', 'ad222222-2222-4222-8222-222222222221',
   'ad333333-3333-4333-8333-333333333333', 'ad444444-4444-4444-8444-444444444444', 'Test request');

insert into public.quotes (id, business_id, client_id, service_address_id, title)
values ('ad777777-7777-4777-8777-777777777771', 'ad222222-2222-4222-8222-222222222221',
 'ad333333-3333-4333-8333-333333333333', 'ad444444-4444-4444-8444-444444444444', 'Test accepted quote');

insert into public.quote_line_items (business_id, quote_id, description, label, quantity, unit_label, unit_price, tax_rate)
values ('ad222222-2222-4222-8222-222222222221', 'ad777777-7777-4777-8777-777777777771',
 'Synthetic labour', 'Fixed work', 2.125, 'hours', 91.55, 0);

update public.quotes set status = 'approved' where id = 'ad777777-7777-4777-8777-777777777771';

insert into public.jobs (id, business_id, client_id, service_address_id, title, status, updated_at)
select x.id::uuid, 'ad222222-2222-4222-8222-222222222221',
  'ad333333-3333-4333-8333-333333333333', 'ad444444-4444-4444-8444-444444444444',
  x.title, 'scheduled', '2020-01-01 00:00:00+00'
from (values
  ('ad666666-6666-4666-8666-666666666661', 'Test unchanged'),
  ('ad666666-6666-4666-8666-666666666662', 'Test changed'),
  ('ad666666-6666-4666-8666-666666666663', 'Test invoice'),
  ('ad666666-6666-4666-8666-666666666664', 'Test approval rollback'),
  ('ad666666-6666-4666-8666-666666666665', 'Test assigned'),
  ('ad666666-6666-4666-8666-666666666666', 'Test direct accepted quote')
) x(id, title);

update public.jobs set quote_id = 'ad777777-7777-4777-8777-777777777771'
where id = 'ad666666-6666-4666-8666-666666666666';

insert into public.job_assignments (business_id, job_id, profile_id) values
  ('ad222222-2222-4222-8222-222222222221', 'ad666666-6666-4666-8666-666666666665',
   'ad111111-1111-4111-8111-111111111113');

do $$
begin
  if has_function_privilege('anon', 'public.prepare_joseph_action(uuid,text,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.approve_joseph_action(uuid,uuid)', 'EXECUTE') then
    raise exception 'An anonymous role can call a Joseph write endpoint';
  end if;
end;
$$;

insert into public.invoices (business_id, client_id, job_id, title, document_status)
values ('ad222222-2222-4222-8222-222222222221', 'ad333333-3333-4333-8333-333333333333',
 'ad666666-6666-4666-8666-666666666664', 'Fixture duplicate', 'draft');

set local role authenticated;

do $$
<<joseph_test>>
declare
  tenant constant uuid := 'ad222222-2222-4222-8222-222222222221';
  other_tenant constant uuid := 'ad222222-2222-4222-8222-222222222222';
  owner constant uuid := 'ad111111-1111-4111-8111-111111111111';
  co_owner constant uuid := 'ad111111-1111-4111-8111-111111111112';
  technician constant uuid := 'ad111111-1111-4111-8111-111111111113';
  outsider constant uuid := 'ad111111-1111-4111-8111-111111111114';
  request constant uuid := 'ad555555-5555-4555-8555-555555555555';
  unchanged constant uuid := 'ad666666-6666-4666-8666-666666666661';
  stale constant uuid := 'ad666666-6666-4666-8666-666666666662';
  invoice_job constant uuid := 'ad666666-6666-4666-8666-666666666663';
  rolled_back constant uuid := 'ad666666-6666-4666-8666-666666666664';
  assigned constant uuid := 'ad666666-6666-4666-8666-666666666665';
  token uuid;
  quote_token uuid;
  expired_token uuid;
begin
  perform set_config('request.jwt.claim.sub', owner::text, true);
  token := (public.prepare_joseph_action(tenant, 'update_job_status', jsonb_build_object(
    'jobId', unchanged, 'status', 'in-progress', 'notes', 'Approved payload', 'confirm', true
  )) ->> 'token')::uuid;
  if token is null or not exists (
    select 1 from public.jobs where id = unchanged and status = 'scheduled' and internal_instructions is null
  ) then
    raise exception 'Model confirmation mutated the job';
  end if;

  perform set_config('request.jwt.claim.sub', co_owner::text, true);
  begin
    perform public.approve_joseph_action(tenant, token);
    raise exception using errcode = 'XX000', message = 'A co-owner reused someone else''s proposal';
  exception when raise_exception then
    if sqlerrm not like '%unavailable%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub', outsider::text, true);
  begin
    perform public.approve_joseph_action(other_tenant, token);
    raise exception using errcode = 'XX000', message = 'A second tenant approved another tenant''s proposal';
  exception when raise_exception then
    if sqlerrm not like '%unavailable%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub', owner::text, true);

  perform public.approve_joseph_action(tenant, token);
  if not exists (select 1 from public.jobs where id = unchanged and status = 'in_progress'
    and internal_instructions = 'Approved payload') then
    raise exception 'Approval did not persist the exact proposed mutation';
  end if;
  begin
    perform public.approve_joseph_action(tenant, token);
    raise exception using errcode = 'XX000', message = 'Joseph proposal was reusable';
  exception when raise_exception then
    if sqlerrm not like '%unavailable%' then raise; end if;
  end;

  token := (public.prepare_joseph_action(tenant, 'update_job_status', jsonb_build_object(
    'jobId', stale, 'status', 'in-progress'
  )) ->> 'token')::uuid;
  update public.jobs set internal_instructions = 'Manual edit' where id = stale;
  begin
    perform public.approve_joseph_action(tenant, token);
    raise exception using errcode = 'XX000', message = 'Joseph accepted an outdated record version';
  exception when raise_exception then
    if sqlerrm not like '%job changed%' then raise; end if;
  end;
  if not exists (select 1 from public.jobs where id = stale and status = 'scheduled'
    and internal_instructions = 'Manual edit') then
    raise exception 'Stale approval overwrote a manual edit';
  end if;

  insert into joseph_private.proposals
    (business_id, actor_id, action_name, target_id, target_version, payload, expires_at)
  select tenant, owner, 'update_job_status', id, updated_at,
    '{"status":"cancelled"}'::jsonb, clock_timestamp() - interval '1 second'
  from public.jobs where id = stale returning joseph_private.proposals.token into expired_token;
  begin
    perform public.approve_joseph_action(tenant, expired_token);
    raise exception using errcode = 'XX000', message = 'Joseph accepted an expired token';
  exception when raise_exception then
    if sqlerrm not like '%unavailable%' then raise; end if;
  end;

  quote_token := (public.prepare_joseph_action(tenant, 'create_quote_from_request', jsonb_build_object(
    'jobRequestId', request, 'scope', 'Test exact quoted scope', 'items', jsonb_build_array(
      jsonb_build_object('description', 'Service', 'quantity', 1.5, 'unitLabel', 'hour', 'rate', 42.25)
    )
  )) ->> 'token')::uuid;
  perform public.approve_joseph_action(tenant, quote_token);
  if not exists (select 1 from public.quotes q join public.quote_line_items l on l.quote_id = q.id
    where q.job_request_id = request and q.title = 'Test exact quoted scope'
      and l.quantity = 1.5 and l.unit_label = 'hour' and l.unit_price = 42.25) then
    raise exception 'Joseph quote did not use the shared draft write';
  end if;

  token := (public.prepare_joseph_action(tenant, 'complete_job_and_draft_invoice', jsonb_build_object(
    'jobId', invoice_job, 'rate', 81.50, 'invoiceNotes', 'Test invoice notes'
  )) ->> 'token')::uuid;
  perform public.approve_joseph_action(tenant, token);
  if not exists (select 1 from public.jobs j join public.invoices i on i.job_id = j.id
    join public.invoice_line_items l on l.invoice_id = i.id where j.id = invoice_job and j.status = 'completed'
      and i.document_status = 'draft' and i.customer_message = 'Test invoice notes' and l.unit_price = 81.50) then
    raise exception 'Valid approval failed to persist the job and invoice together';
  end if;

  token := (public.prepare_joseph_action(tenant, 'complete_job_and_draft_invoice', '{
    "jobId":"ad666666-6666-4666-8666-666666666666",
    "nextStop":{"chip":"done-draft-invoice","quoteId":"ad777777-7777-4777-8777-777777777771"}
  }'::jsonb) ->> 'token')::uuid;
  perform public.approve_joseph_action(tenant, token);
  if not exists (select 1 from public.invoices i join public.invoice_line_items l on l.invoice_id = i.id
    where i.job_id = 'ad666666-6666-4666-8666-666666666666'
      and i.quote_id = 'ad777777-7777-4777-8777-777777777771' and i.document_status = 'draft'
      and l.label = 'Fixed work' and l.quantity = 2.125 and l.unit_label = 'hours' and l.unit_price = 91.55) then
    raise exception 'Next Stop approval did not preserve the linked accepted quote and its exact line';
  end if;

  -- The shared invoice writer rejects the existing active link. The Joseph
  -- completion and the single-use claim must both roll back.
  token := (public.prepare_joseph_action(tenant, 'complete_job_and_draft_invoice', jsonb_build_object(
    'jobId', rolled_back, 'rate', 42
  )) ->> 'token')::uuid;
  begin
    perform public.approve_joseph_action(tenant, token);
    raise exception using errcode = 'XX000', message = 'Joseph duplicated an already invoiced visit';
  exception when raise_exception then
    if sqlerrm not like '%invoice already exists%' then raise; end if;
  end;
  if not exists (select 1 from public.jobs where id = rolled_back and status = 'scheduled')
    or not exists (select 1 from joseph_private.proposals p where p.token = joseph_test.token) then
    raise exception 'The failed invoice did not roll back the job and proposal claim';
  end if;

  perform set_config('request.jwt.claim.sub', technician::text, true);
  begin
    perform public.prepare_joseph_action(tenant, 'complete_job_and_draft_invoice', jsonb_build_object(
      'jobId', assigned, 'rate', 50
    ));
    raise exception using errcode = 'XX000', message = 'Technician proposed a financial write';
  exception when raise_exception then
    if sqlerrm not like '%owners%' then raise; end if;
  end;
  begin
    perform public.prepare_joseph_action(tenant, 'update_job_status', jsonb_build_object(
      'jobId', invoice_job, 'status', 'in-progress'
    ));
    raise exception using errcode = 'XX000', message = 'Technician proposed a write for an unassigned job';
  exception when raise_exception then
    if sqlerrm not like '%permission%' then raise; end if;
  end;
  token := (public.prepare_joseph_action(tenant, 'update_job_status', jsonb_build_object(
    'jobId', assigned, 'status', 'in-progress'
  )) ->> 'token')::uuid;
  perform public.approve_joseph_action(tenant, token);
  if not exists (select 1 from public.jobs where id = assigned and status = 'in_progress') then
    raise exception 'Assigned technician could not approve a valid status change';
  end if;
end;
$$;

rollback;
