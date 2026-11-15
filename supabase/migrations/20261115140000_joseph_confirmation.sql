-- Approval tokens are opaque to the model. Only the human-facing approval action
-- redeems one, using the same authenticated session as the manual write paths.
create schema if not exists joseph_private;
revoke all on schema joseph_private from public, anon, authenticated;
grant usage on schema joseph_private to authenticated;

create table joseph_private.proposals (
  token uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  action_name text not null check (action_name in (
    'update_job_status', 'complete_job_and_draft_invoice', 'create_quote_from_request'
  )),
  target_id uuid not null,
  target_version timestamptz not null,
  payload jsonb not null,
  expires_at timestamptz not null default (statement_timestamp() + interval '5 minutes')
);

alter table joseph_private.proposals enable row level security;
revoke all on table joseph_private.proposals from public, anon, authenticated;
grant select, insert, delete on table joseph_private.proposals to authenticated;

create policy proposals_actor_and_business
on joseph_private.proposals for all to authenticated
using (actor_id = (select auth.uid()) and public.is_business_member(business_id))
with check (actor_id = (select auth.uid()) and public.is_business_member(business_id));

create index joseph_proposals_expiry_idx
  on joseph_private.proposals (actor_id, business_id, expires_at);

create function public.prepare_joseph_action(
  target_business_id uuid, action_name text, args jsonb
) returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  authenticated_actor uuid := auth.uid();
  job public.jobs%rowtype;
  request public.job_requests%rowtype;
  source_quote public.quotes%rowtype;
  recurrence public.job_recurrences%rowtype;
  target_id uuid;
  target_version timestamptz;
  token uuid := gen_random_uuid();
  client_id uuid;
  property_id uuid;
  client_name text;
  property_address text;
  target_title text;
  chip text := args #>> '{nextStop,chip}';
  status public.job_status;
  notes text;
  draft jsonb;
  items jsonb;
  scope text;
  price numeric;
  issue_date date := (statement_timestamp() at time zone 'Australia/Brisbane')::date;
  payload jsonb;
  approval_title text;
begin
  if authenticated_actor is null or not public.is_business_member(target_business_id) then
    raise exception 'Sign in to propose a Joseph action.';
  end if;

  if action_name not in ('update_job_status', 'complete_job_and_draft_invoice', 'create_quote_from_request')
      or action_name is null then
    raise exception 'This Joseph action is unavailable.';
  end if;

  if action_name <> 'update_job_status' and not public.can_manage_business(target_business_id) then
    raise exception 'Only owners and co-owners can draft quotes or invoices.';
  end if;

  if action_name = 'create_quote_from_request' then
    select * into request from public.job_requests r
    where r.id = (args ->> 'jobRequestId')::uuid and r.business_id = target_business_id;

    if not found or request.client_id is null then
      raise exception 'This request needs a client before Joseph can draft a quote.';
    end if;

    target_id := request.id;
    target_version := request.updated_at;
    target_title := request.title;
    client_id := request.client_id;
    property_id := request.service_address_id;
    scope := args ->> 'scope';
    draft := jsonb_strip_nulls(jsonb_build_object(
      'jobRequestId', request.id,
      'scope', scope, 'items', args -> 'items', 'issueDate', issue_date,
      'validUntil', issue_date + 14, 'clientNotes', '', 'internalNotes', 'Drafted by Joseph'
    ));
    approval_title := 'Save draft quote';
  else
    select * into job from public.jobs j
    where j.id = (args ->> 'jobId')::uuid and j.business_id = target_business_id;

    if not found or (not public.can_manage_business(target_business_id)
        and not public.is_assigned_to_job(job.id, target_business_id)) then
      raise exception 'You do not have permission to update this job.';
    end if;

    if chip is not null and job.status in ('completed', 'cancelled') then
      raise exception 'That next stop is no longer open.';
    end if;

    target_id := job.id;
    target_version := job.updated_at;
    target_title := concat_ws(' · ', job.document_number, job.title);
    client_id := job.client_id;
    property_id := job.service_address_id;
    select * into recurrence from public.job_recurrences r
    where r.job_id = job.id and r.business_id = target_business_id;

    if not public.can_manage_business(target_business_id)
        and (chip = 'running-late' or (chip is null and args ? 'notes')) then
      raise exception 'Only owners and co-owners can change job notes.';
    end if;

    notes := coalesce(args ->> 'notes', job.internal_instructions);
    if not public.can_manage_business(target_business_id) then
      notes := null;
    elsif chip in ('on-my-way', 'running-late') then
      notes := concat_ws(E'\n',
        case chip when 'on-my-way' then '[[joseph-ops:en-route]]' else '[[joseph-ops:running-late]]' end,
        nullif(regexp_replace(coalesce(job.internal_instructions, ''),
          '^\s*\[\[joseph-ops:(en-route|running-late)\]\]\s*', '', 'i'), '')
      );
    end if;

    if action_name = 'update_job_status' then
      status := case
        when chip = 'on-my-way' then 'in_progress'
        when chip = 'running-late' then job.status
        when args ->> 'status' = 'in-progress' then 'in_progress'
        when args ->> 'status' = 'on-hold' then 'paused'
        else (args ->> 'status')::public.job_status
      end;
      if status is null then raise exception 'Choose a job status.'; end if;
      approval_title := case chip
        when 'on-my-way' then 'Mark on my way'
        when 'running-late' then 'Mark running late'
        else 'Update job status'
      end;
    else
      if property_id is null then
        raise exception 'This job needs a service property before Joseph can draft an invoice.';
      end if;
      if job.status in ('completed', 'cancelled') then
        raise exception 'This job is already closed. Use the manual invoice composer if an invoice is needed.';
      end if;

      select * into source_quote from public.quotes q
      where q.business_id = target_business_id and q.client_id = job.client_id
        and q.service_address_id = job.service_address_id and q.status = 'approved'
        and (q.id = job.quote_id or (job.quote_id is null and q.job_request_id = job.job_request_id))
        and (chip is distinct from 'done-draft-invoice' or q.id = (args #>> '{nextStop,quoteId}')::uuid)
      order by q.id = job.quote_id desc nulls last, q.approved_at desc nulls last, q.id
      limit 1;

      if chip = 'done-draft-invoice' and source_quote.id is null then
        raise exception 'This stop has no matching accepted quote to invoice from.';
      end if;

      if source_quote.id is not null then
        select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'label', i.label, 'description', i.description, 'quantity', i.quantity,
          'unitLabel', i.unit_label, 'rate', i.unit_price
        )) order by i.position) into items
        from public.quote_line_items i
        where i.quote_id = source_quote.id and i.business_id = target_business_id;
      end if;

      scope := coalesce(nullif(btrim(job.scope_of_work), ''), job.title);
      if items is null then
        price := (args ->> 'rate')::numeric;
        if price is null or price < 0 or price > 10000000 then
          raise exception 'A valid rate is required to draft an invoice for this job.';
        end if;
        items := jsonb_build_array(jsonb_build_object(
          'description', scope, 'quantity', 1, 'unitLabel', 'ea', 'rate', price
        ));
      end if;

      draft := jsonb_strip_nulls(jsonb_build_object(
        'idempotencyKey', token, 'clientId', client_id, 'propertyId', property_id,
        'jobId', job.id, 'quoteId', source_quote.id, 'requestId', job.job_request_id,
        'scope', scope, 'items', items, 'issueDate', issue_date, 'dueDate', issue_date + 7,
        'notes', args ->> 'invoiceNotes'
      ));
      status := 'completed';
      approval_title := 'Complete job and draft invoice';
    end if;
  end if;

  select c.display_name into client_name from public.clients c
  where c.id = client_id and c.business_id = target_business_id;
  select a.line_1 into property_address from public.client_addresses a
  where a.id = property_id and a.business_id = target_business_id;

  payload := jsonb_build_object(
    'status', status, 'notes', notes, 'draft', draft, 'chip', chip,
    'quoteId', source_quote.id, 'quoteVersion', source_quote.updated_at,
    'recurrenceFrequency', recurrence.frequency, 'recurrenceInterval', recurrence.interval_count,
    'recurrenceVersion', recurrence.updated_at,
    'preparedAsManager', public.can_manage_business(target_business_id)
  );

  delete from joseph_private.proposals p
  where p.actor_id = authenticated_actor and p.business_id = target_business_id
    and p.expires_at <= statement_timestamp();

  insert into joseph_private.proposals
    (token, business_id, actor_id, action_name, target_id, target_version, payload)
  values (token, target_business_id, authenticated_actor, action_name, target_id, target_version, payload);

  return jsonb_strip_nulls(jsonb_build_object(
    'token', token, 'title', approval_title, 'targetLabel', target_title,
    'client', coalesce(client_name, 'Client'), 'address', property_address,
    'status', status, 'notes', notes, 'draft', draft,
    'recurring', recurrence.job_id is not null
  ));
end;
$$;

create function public.approve_joseph_action(
  target_business_id uuid, proposal_token uuid
) returns text
language plpgsql security invoker set search_path = ''
as $$
declare
  authenticated_actor uuid := auth.uid();
  proposal joseph_private.proposals%rowtype;
  source_quote_version timestamptz;
  request_version timestamptz;
  recurrence_version timestamptz;
  job public.jobs%rowtype;
  document_id uuid;
  document_number text;
  next_visit_id uuid;
begin
  if authenticated_actor is null or not public.is_business_member(target_business_id) then
    raise exception 'Sign in to approve a Joseph action.';
  end if;

  -- DELETE locks and claims exactly one live token. Any failed shared write
  -- rolls back this claim together with the business changes.
  delete from joseph_private.proposals p
  where p.token = proposal_token and p.actor_id = authenticated_actor
    and p.business_id = target_business_id and p.expires_at > clock_timestamp()
  returning * into proposal;

  if not found then
    raise exception 'This proposal has expired, been used, or is unavailable. Review a new proposal.';
  end if;

  if (proposal.payload ->> 'preparedAsManager')::boolean is distinct from public.can_manage_business(target_business_id) then
    raise exception 'Your permissions changed. Review a new proposal.';
  end if;

  if proposal.action_name <> 'update_job_status' and not public.can_manage_business(target_business_id) then
    raise exception 'Only owners and co-owners can draft quotes or invoices.';
  end if;

  if proposal.action_name = 'create_quote_from_request' then
    select r.updated_at into request_version from public.job_requests r
    where r.id = proposal.target_id and r.business_id = target_business_id
    for share;
    if request_version is distinct from proposal.target_version then
      raise exception 'The request changed. Review a new proposal.';
    end if;
    if proposal.expires_at <= clock_timestamp() then
      raise exception 'This proposal has expired. Review a new proposal.';
    end if;
    document_id := public.save_work_quote(target_business_id, proposal.payload -> 'draft');
    select q.document_number into document_number from public.quotes q
    where q.id = document_id and q.business_id = target_business_id;
    return 'Draft quote ' || coalesce(document_number, document_id::text) || ' saved.';
  end if;

  -- Match save_invoice_draft's lock order before touching the related visit.
  perform pg_advisory_xact_lock(hashtextextended('invoice-source:' || target_business_id::text, 0));

  select * into job from public.jobs j
  where j.id = proposal.target_id and j.business_id = target_business_id
  for update;
  if job.updated_at is distinct from proposal.target_version then
    raise exception 'The job changed. Review a new proposal.';
  end if;

  if public.can_manage_business(target_business_id) then
    select r.updated_at into recurrence_version from public.job_recurrences r
    where r.job_id = proposal.target_id and r.business_id = target_business_id
    for share;
    if recurrence_version is distinct from (proposal.payload ->> 'recurrenceVersion')::timestamptz then
      raise exception 'The job recurrence changed. Review a new proposal.';
    end if;
  end if;

  if proposal.action_name = 'complete_job_and_draft_invoice' and proposal.payload ->> 'quoteId' is not null then
    select q.updated_at into source_quote_version from public.quotes q
    where q.id = (proposal.payload ->> 'quoteId')::uuid and q.business_id = target_business_id
      and q.status = 'approved'
    for share;
    if source_quote_version is distinct from (proposal.payload ->> 'quoteVersion')::timestamptz then
      raise exception 'The accepted quote changed. Review a new proposal.';
    end if;
  end if;

  if proposal.expires_at <= clock_timestamp() then
    raise exception 'This proposal has expired. Review a new proposal.';
  end if;
  next_visit_id := public.update_work_job(
    target_business_id, proposal.target_id, (proposal.payload ->> 'status')::public.job_status,
    proposal.payload ->> 'notes', (proposal.payload ->> 'recurrenceFrequency')::public.recurrence_frequency,
    (proposal.payload ->> 'recurrenceInterval')::integer, false, null, proposal.target_version
  );

  if proposal.action_name = 'complete_job_and_draft_invoice' then
    document_id := public.save_invoice_draft(proposal.payload -> 'draft');
    select i.document_number into document_number from public.invoices i
    where i.id = document_id and i.business_id = target_business_id;
    return 'Job completed and draft invoice ' || coalesce(document_number, document_id::text) || ' saved.'
      || case when next_visit_id is not null then ' Next visit scheduled.' else '' end;
  end if;

  if proposal.payload ->> 'chip' = 'on-my-way' and public.can_manage_business(target_business_id) then
    return 'Marked on my way.';
  end if;
  if proposal.payload ->> 'chip' = 'running-late' then return 'Marked running late.'; end if;
  return 'Job status updated.' || case when next_visit_id is not null then ' Next visit scheduled.' else '' end;
end;
$$;

revoke all on function public.prepare_joseph_action(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.approve_joseph_action(uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_joseph_action(uuid, text, jsonb) to authenticated;
grant execute on function public.approve_joseph_action(uuid, uuid) to authenticated;
