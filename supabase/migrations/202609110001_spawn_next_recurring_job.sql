begin;

create unique index if not exists jobs_recurrence_instance_uniq
on public.jobs (business_id, recurrence_parent_job_id, recurrence_instance_date)
where recurrence_parent_job_id is not null and recurrence_instance_date is not null;

create or replace function public.spawn_next_recurring_job(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  completed public.jobs%rowtype;
  rec public.job_recurrences%rowtype;
  next_start timestamptz;
  next_end timestamptz;
  next_date date;
  duration interval;
  next_id uuid;
  existing_id uuid;
begin
  select * into completed from public.jobs where id = p_job_id;
  if not found then
    return null;
  end if;
  if completed.status is distinct from 'completed' then
    return null;
  end if;
  if completed.scheduled_start is null then
    return null;
  end if;

  select * into rec
  from public.job_recurrences
  where job_id = completed.id
     or job_id = completed.recurrence_parent_job_id
  order by case when job_id = completed.id then 0 else 1 end
  limit 1;
  if not found then
    return null;
  end if;

  duration := coalesce(completed.scheduled_end - completed.scheduled_start, interval '1 hour');
  if rec.frequency = 'weekly' then
    next_start := completed.scheduled_start + (rec.interval_count * interval '1 week');
  elsif rec.frequency = 'monthly' then
    next_start := completed.scheduled_start + (rec.interval_count * interval '1 month');
  elsif rec.frequency = 'daily' then
    next_start := completed.scheduled_start + (rec.interval_count * interval '1 day');
  elsif rec.frequency = 'yearly' then
    next_start := completed.scheduled_start + (rec.interval_count * interval '1 year');
  else
    return null;
  end if;

  next_end := next_start + duration;
  next_date := (next_start at time zone coalesce(completed.schedule_timezone, 'Australia/Brisbane'))::date;

  if rec.ends_on is not null and next_date > rec.ends_on then
    return null;
  end if;

  if rec.max_occurrences is not null then
    if (
      select count(*)
      from public.jobs
      where business_id = completed.business_id
        and (
          id = coalesce(completed.recurrence_parent_job_id, completed.id)
          or recurrence_parent_job_id = coalesce(completed.recurrence_parent_job_id, completed.id)
        )
    ) >= rec.max_occurrences then
      return null;
    end if;
  end if;

  select id into existing_id
  from public.jobs
  where business_id = completed.business_id
    and recurrence_parent_job_id = completed.id
    and recurrence_instance_date = next_date
  limit 1;
  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.jobs (
    business_id,
    client_id,
    client_contact_id,
    service_address_id,
    job_request_id,
    recurrence_parent_job_id,
    recurrence_instance_date,
    status,
    priority,
    title,
    scope_of_work,
    internal_instructions,
    scheduled_start,
    scheduled_end,
    schedule_timezone,
    created_by
  ) values (
    completed.business_id,
    completed.client_id,
    completed.client_contact_id,
    completed.service_address_id,
    completed.job_request_id,
    completed.id,
    next_date,
    'scheduled',
    completed.priority,
    completed.title,
    completed.scope_of_work,
    completed.internal_instructions,
    next_start,
    next_end,
    completed.schedule_timezone,
    completed.created_by
  )
  returning id into next_id;

  insert into public.job_assignments (business_id, job_id, profile_id, is_lead, assigned_by)
  select business_id, next_id, profile_id, is_lead, assigned_by
  from public.job_assignments
  where job_id = completed.id;

  insert into public.job_recurrences (
    job_id,
    business_id,
    frequency,
    interval_count,
    by_weekday,
    by_month_day,
    custom_rrule,
    starts_on,
    ends_on,
    max_occurrences
  )
  values (
    next_id,
    rec.business_id,
    rec.frequency,
    rec.interval_count,
    rec.by_weekday,
    rec.by_month_day,
    rec.custom_rrule,
    next_date,
    rec.ends_on,
    rec.max_occurrences
  )
  on conflict (job_id) do nothing;

  return next_id;
end;
$$;

revoke all on function public.spawn_next_recurring_job(uuid) from public;
grant execute on function public.spawn_next_recurring_job(uuid) to authenticated;

commit;
