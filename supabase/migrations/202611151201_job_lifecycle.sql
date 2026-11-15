begin;

create function public.guard_job_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('completed', 'cancelled') and (
    new.status is distinct from old.status
    or new.scheduled_start is distinct from old.scheduled_start
    or new.scheduled_end is distinct from old.scheduled_end
  ) then
    raise exception 'Completed or cancelled jobs cannot be moved or rescheduled';
  end if;
  if new.status = 'scheduled' and (old.status is distinct from new.status
    or new.scheduled_start is distinct from old.scheduled_start)
    and (new.scheduled_start is null or new.service_address_id is null) then
    raise exception 'A scheduled job needs a start time and a service address';
  end if;
  return new;
end;
$$;

create trigger jobs_guard_lifecycle before update on public.jobs
  for each row execute function public.guard_job_lifecycle();

-- Internal only. Both manager and assigned technician transitions reach it through
-- the same AFTER UPDATE trigger and complete inside the originating transaction.
create or replace function public.spawn_next_recurring_job(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  completed public.jobs%rowtype;
  rec public.job_recurrences%rowtype;
  next_start timestamptz;
  next_date date;
  step interval;
  schedule_zone text;
  next_id uuid;
  root_job_id uuid;
begin
  select * into completed from public.jobs where id = p_job_id for update;
  if not found or completed.status <> 'completed' or completed.scheduled_start is null then
    return null;
  end if;

  select id into next_id from public.jobs
    where business_id = completed.business_id and recurrence_parent_job_id = completed.id
    order by scheduled_start, id limit 1;
  if found then return next_id; end if;

  select * into rec from public.job_recurrences
    where job_id = completed.id and business_id = completed.business_id;
  if not found then return null; end if;

  step := rec.interval_count * case rec.frequency
    when 'daily' then interval '1 day'
    when 'weekly' then interval '1 week'
    when 'monthly' then interval '1 month'
    when 'yearly' then interval '1 year'
    else null end;
  if step is null then return null; end if;

  schedule_zone := completed.schedule_timezone;
  next_start := ((completed.scheduled_start at time zone schedule_zone) + step) at time zone schedule_zone;
  next_date := (next_start at time zone schedule_zone)::date;
  if rec.ends_on is not null and next_date > rec.ends_on then return null; end if;

  if rec.max_occurrences is not null then
    with recursive ancestors as (
      select j.id, j.recurrence_parent_job_id from public.jobs j where j.id = completed.id
      union
      select j.id, j.recurrence_parent_job_id from public.jobs j join ancestors a on j.id = a.recurrence_parent_job_id
      where j.business_id = completed.business_id
    ) select id into root_job_id from ancestors where recurrence_parent_job_id is null;

    if (
      with recursive occurrences as (
        select coalesce(root_job_id, completed.id) as id
        union
        select j.id from public.jobs j join occurrences o on j.recurrence_parent_job_id = o.id
        where j.business_id = completed.business_id
      ) select count(*) from occurrences
    ) >= rec.max_occurrences then return null; end if;
  end if;

  insert into public.jobs (
    business_id, client_id, client_contact_id, service_address_id, job_request_id,
    recurrence_parent_job_id, recurrence_instance_date, status, priority, title, scope_of_work,
    internal_instructions, scheduled_start, scheduled_end, schedule_timezone, created_by
  ) values (
    completed.business_id, completed.client_id, completed.client_contact_id, completed.service_address_id,
    completed.job_request_id, completed.id, next_date, 'scheduled', completed.priority, completed.title,
    completed.scope_of_work, completed.internal_instructions, next_start,
    next_start + coalesce(completed.scheduled_end - completed.scheduled_start, interval '1 hour'),
    schedule_zone, coalesce(auth.uid(), completed.created_by)
  ) returning id into next_id;

  insert into public.job_assignments (business_id, job_id, profile_id, is_lead, assigned_by)
  select business_id, next_id, profile_id, is_lead, assigned_by
  from public.job_assignments where job_id = completed.id and business_id = completed.business_id;

  insert into public.job_recurrences (
    job_id, business_id, frequency, interval_count, by_weekday, by_month_day, custom_rrule,
    starts_on, ends_on, max_occurrences
  ) values (
    next_id, rec.business_id, rec.frequency, rec.interval_count, rec.by_weekday,
    rec.by_month_day, rec.custom_rrule, next_date, rec.ends_on, rec.max_occurrences
  );

  return next_id;
end;
$$;

create function public.advance_completed_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.spawn_next_recurring_job(new.id);
  return new;
end;
$$;

create trigger jobs_advance_completed after update of status on public.jobs
  for each row when (old.status is distinct from new.status and new.status = 'completed')
  execute function public.advance_completed_job();

create function public.update_work_job(
  target_business_id uuid,
  target_job_id uuid,
  target_status public.job_status,
  job_notes text,
  recurrence_frequency public.recurrence_frequency,
  recurrence_interval integer,
  change_schedule boolean,
  new_start timestamptz,
  expected_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job public.jobs%rowtype;
  manager boolean := public.can_manage_business(target_business_id);
  next_id uuid;
  start_value timestamptz;
  end_value timestamptz;
begin
  if not manager and not (
    public.current_business_role() = 'technician'
      and public.is_assigned_to_job(target_job_id, target_business_id)
  ) then
    raise exception 'You do not have permission to update this job' using errcode = '42501';
  end if;

  select * into job from public.jobs where id = target_job_id
    and business_id = target_business_id for update;
  if not found then raise exception 'Job could not be found'; end if;
  if expected_updated_at is not null and job.updated_at is distinct from expected_updated_at then
    raise exception 'This job changed after it was opened. Reload it and try again.';
  end if;
  if target_status is null then raise exception 'Choose a job status'; end if;

  if job.status in ('completed', 'cancelled') then
    if job.status is distinct from target_status then
      raise exception 'Completed or cancelled jobs cannot be moved';
    end if;
    if manager and job.internal_instructions is distinct from nullif(job_notes, '') then
      update public.jobs set internal_instructions = nullif(job_notes, '')
        where id = target_job_id and business_id = target_business_id;
    end if;
  elsif manager then
    start_value := case when target_status = 'unscheduled' then null when change_schedule then new_start else job.scheduled_start end;
    end_value := case when start_value is null then null when start_value = job.scheduled_start then job.scheduled_end
      else start_value + coalesce(job.scheduled_end - job.scheduled_start, interval '1 hour') end;

    if recurrence_frequency is null then
      delete from public.job_recurrences where job_id = target_job_id and business_id = target_business_id;
    else
      if recurrence_frequency not in ('weekly', 'monthly') or recurrence_interval not between 1 and 4
        or recurrence_interval is null then
        raise exception 'Choose a supported job repeat interval';
      end if;
      insert into public.job_recurrences (job_id, business_id, frequency, interval_count, starts_on)
      values (target_job_id, target_business_id, recurrence_frequency, recurrence_interval,
        coalesce((start_value at time zone job.schedule_timezone)::date, (now() at time zone job.schedule_timezone)::date))
      on conflict (job_id) do update set frequency = excluded.frequency, interval_count = excluded.interval_count,
        starts_on = least(excluded.starts_on, coalesce(public.job_recurrences.ends_on, excluded.starts_on));
    end if;

    update public.jobs set status = target_status, internal_instructions = nullif(job_notes, ''),
      scheduled_start = start_value, scheduled_end = end_value
      where id = target_job_id and business_id = target_business_id;
  elsif job.status is distinct from target_status then
    -- Existing technician trigger enforces the role-specific transition graph.
    update public.jobs set status = target_status
      where id = target_job_id and business_id = target_business_id;
  end if;

  if target_status = 'completed' then
    select id into next_id from public.jobs
      where business_id = target_business_id and recurrence_parent_job_id = target_job_id
      order by scheduled_start, id limit 1;
  end if;
  return next_id;
end;
$$;

revoke all on function public.guard_job_lifecycle() from public, anon, authenticated;
revoke all on function public.spawn_next_recurring_job(uuid) from public, anon, authenticated;
revoke all on function public.advance_completed_job() from public, anon, authenticated;
revoke all on function public.update_work_job(uuid, uuid, public.job_status, text, public.recurrence_frequency, integer, boolean, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.update_work_job(uuid, uuid, public.job_status, text, public.recurrence_frequency, integer, boolean, timestamptz, timestamptz) to authenticated;

create function public.guard_job_history_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status not in ('unscheduled', 'scheduled') or nullif(btrim(old.internal_instructions), '') is not null
    or exists (select 1 from public.job_notes where job_id = old.id and business_id = old.business_id)
    or exists (select 1 from public.job_attachments where job_id = old.id and business_id = old.business_id)
    or old.job_request_id is not null or old.quote_id is not null
    or exists (select 1 from public.invoices where job_id = old.id and business_id = old.business_id) then
    raise exception 'This job has operational history and must be kept. Cancel it if it is inactive.';
  end if;
  return old;
end;
$$;

create trigger jobs_guard_history_delete before delete on public.jobs
  for each row execute function public.guard_job_history_delete();

create function public.add_work_job_note(target_business_id uuid, target_job_id uuid, new_note_id uuid, note_body text)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  new_body text := nullif(btrim(note_body), '');
  saved_id uuid;
begin
  if actor_id is null or not (public.can_manage_business(target_business_id)
    or public.is_assigned_to_job(target_job_id, target_business_id)) then
    raise exception 'You do not have permission to add notes to this job' using errcode = '42501';
  end if;
  if new_note_id is null or new_body is null or char_length(new_body) > 20000 then
    raise exception 'Enter a valid field note';
  end if;
  perform 1 from public.jobs where id = target_job_id and business_id = target_business_id for update;
  if not found then raise exception 'Job could not be found'; end if;

  insert into public.job_notes (id, business_id, job_id, body, is_customer_visible, created_by)
  values (new_note_id, target_business_id, target_job_id, new_body, false, actor_id)
  on conflict (id) do nothing
  returning id into saved_id;

  if saved_id is null then
    select id into saved_id from public.job_notes where id = new_note_id and business_id = target_business_id
      and job_id = target_job_id and body = new_body and created_by = actor_id;
    if saved_id is null then raise exception 'The field note has already been saved with different details'; end if;
  end if;
  return saved_id;
end;
$$;

create function public.set_work_job_assignments(target_business_id uuid, target_job_id uuid, chosen_profiles uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen uuid[];
  lead_profile uuid;
begin
  if not public.can_manage_business(target_business_id) then
    raise exception 'Only managers can assign jobs' using errcode = '42501';
  end if;
  perform 1 from public.jobs where id = target_job_id and business_id = target_business_id
    and status not in ('completed', 'cancelled') for update;
  if not found then raise exception 'Choose an active job'; end if;

  select array_agg(profile_id order by first_position) into chosen
  from (
    select profile_id, min(position) as first_position
    from unnest(chosen_profiles) with ordinality a(profile_id, position)
    group by profile_id
  ) sorted;
  lead_profile := chosen[1];
  if cardinality(chosen) > 50 or (
    select count(*) from public.profiles
    where id = any(chosen) and business_id = target_business_id and is_active
  ) <> coalesce(cardinality(chosen), 0) then
    raise exception 'One or more selected team members are unavailable';
  end if;

  delete from public.job_assignments where job_id = target_job_id and business_id = target_business_id
    and not (profile_id = any(coalesce(chosen, '{}'::uuid[])));
  update public.job_assignments set is_lead = false
    where job_id = target_job_id and business_id = target_business_id and is_lead and profile_id <> lead_profile;
  insert into public.job_assignments (business_id, job_id, profile_id, assigned_by)
  select target_business_id, target_job_id, profile_id, auth.uid() from unnest(chosen) ids(profile_id)
    on conflict (job_id, profile_id) do nothing;
  update public.job_assignments set is_lead = true
    where job_id = target_job_id and business_id = target_business_id and profile_id = lead_profile and not is_lead;

  return target_job_id;
end;
$$;

revoke insert, update, delete on public.job_assignments from authenticated;
revoke all on function public.guard_job_history_delete() from public, anon, authenticated;
revoke all on function public.add_work_job_note(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.set_work_job_assignments(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.add_work_job_note(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.set_work_job_assignments(uuid, uuid, uuid[]) to authenticated;

commit;
