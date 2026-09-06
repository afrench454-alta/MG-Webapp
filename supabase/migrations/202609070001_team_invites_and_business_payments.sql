begin;

create type public.team_invitation_status as enum (
  'pending',
  'accepted',
  'revoked',
  'expired'
);

create table public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  email text not null check (char_length(btrim(email)) between 3 and 320),
  role public.app_role not null,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status public.team_invitation_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '14 days'),
  invited_by uuid references auth.users (id) on delete set null,
  accepted_profile_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role in ('co_owner', 'technician')),
  unique (id, business_id)
);

create unique index team_invitations_pending_email_idx
  on public.team_invitations (business_id, lower(email))
  where status = 'pending';

create index team_invitations_business_status_idx
  on public.team_invitations (business_id, status, created_at desc);

create trigger team_invitations_touch_updated_at
before update on public.team_invitations
for each row execute function public.touch_updated_at();

alter table public.business_settings
  add column if not exists payment_to text,
  add column if not exists bsb text,
  add column if not exists account_number text,
  add column if not exists quote_terms text,
  add column if not exists invoice_terms text;

update public.business_settings
set
  payment_to = coalesce(nullif(btrim(payment_to), ''), 'Jodie T/A Mow Glow PS'),
  bsb = coalesce(nullif(btrim(bsb), ''), '084-961'),
  account_number = coalesce(nullif(btrim(account_number), ''), '853110869'),
  quote_terms = coalesce(
    nullif(btrim(quote_terms), ''),
    'This quotation is an estimate only. Any unforeseen costs, additional materials, or extra labour required may result in additional charges. The client will be notified before any changes or additional work is carried out.'
  ),
  invoice_terms = coalesce(
    nullif(btrim(invoice_terms), ''),
    'Invoices due upon completion have a grace period of 7 days only. Mow & Glow Property Services is a current ABN holder, carries public liability insurance, and is not registered for GST.'
  );

alter table public.team_invitations enable row level security;

create policy team_invitations_select_managers
on public.team_invitations for select to authenticated
using (public.can_manage_business(business_id));

revoke insert, update, delete on table public.team_invitations from anon, authenticated;
grant select on table public.team_invitations to authenticated;

create function public.create_team_invitation(
  target_email text,
  target_role public.app_role,
  raw_token text,
  target_expires_at timestamptz default (now() + interval '14 days')
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  target_business_id uuid;
  invitation_id uuid;
  normalised_email text;
begin
  target_business_id := public.current_business_id();

  if target_business_id is null
     or not public.can_manage_business(target_business_id) then
    raise exception 'Owner or co-owner access is required';
  end if;

  if target_role not in ('co_owner', 'technician') then
    raise exception 'Team members can be invited as co-owner or technician';
  end if;

  if char_length(raw_token) < 32 then
    raise exception 'Invitation tokens must contain at least 32 characters';
  end if;

  if target_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future';
  end if;

  normalised_email := lower(btrim(coalesce(target_email, '')));
  if char_length(normalised_email) not between 3 and 320
     or normalised_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid invitation email is required';
  end if;

  if exists (
    select 1
    from public.profiles p
    where p.business_id = target_business_id
      and lower(coalesce(p.email, '')) = normalised_email
      and p.is_active
  ) then
    raise exception 'That email already belongs to this team';
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(coalesce(p.email, '')) = normalised_email
      and p.business_id is distinct from target_business_id
  ) then
    raise exception 'That email already belongs to another workspace';
  end if;

  update public.team_invitations
  set status = 'revoked'
  where business_id = target_business_id
    and lower(email) = normalised_email
    and status = 'pending';

  insert into public.team_invitations (
    business_id,
    email,
    role,
    token_hash,
    status,
    expires_at,
    invited_by
  )
  values (
    target_business_id,
    normalised_email,
    target_role,
    encode(digest(raw_token, 'sha256'), 'hex'),
    'pending',
    target_expires_at,
    auth.uid()
  )
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create function public.revoke_team_invitation(target_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_business_id uuid;
  revoked_id uuid;
begin
  target_business_id := public.current_business_id();

  if target_business_id is null
     or not public.can_manage_business(target_business_id) then
    raise exception 'Owner or co-owner access is required';
  end if;

  update public.team_invitations
  set status = 'revoked'
  where id = target_invitation_id
    and business_id = target_business_id
    and status = 'pending'
  returning id into revoked_id;

  if revoked_id is null then
    raise exception 'Invitation not found or already used';
  end if;

  return revoked_id;
end;
$$;

create function public.accept_team_invitation(raw_token text)
returns table (
  business_id uuid,
  business_name text,
  member_role public.app_role
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  actor_user_id uuid := auth.uid();
  actor_email text;
  token_digest text;
  invitation_record public.team_invitations%rowtype;
begin
  if actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(coalesce(raw_token, '')) < 32 then
    raise exception 'Invitation token is invalid';
  end if;

  actor_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  token_digest := encode(digest(raw_token, 'sha256'), 'hex');

  select i.*
  into invitation_record
  from public.team_invitations i
  where i.token_hash = token_digest
  limit 1;

  if not found then
    raise exception 'This invite link is invalid';
  end if;

  if invitation_record.expires_at <= now() then
    if invitation_record.status = 'pending' then
      update public.team_invitations
      set status = 'expired'
      where id = invitation_record.id;
    end if;
    raise exception 'This invite link has expired';
  end if;

  if invitation_record.status = 'revoked' then
    raise exception 'This invite link has been revoked';
  end if;

  if invitation_record.status = 'accepted' then
    select p.business_id, b.name, p.role
    into business_id, business_name, member_role
    from public.profiles p
    join public.businesses b on b.id = p.business_id
    where p.id = actor_user_id
      and p.business_id = invitation_record.business_id
      and p.is_active
    limit 1;

    if found then
      return next;
      return;
    end if;
    raise exception 'This invite link has already been used';
  end if;

  if invitation_record.status <> 'pending' then
    raise exception 'This invite link is no longer valid';
  end if;

  if actor_email = '' or actor_email is distinct from lower(invitation_record.email) then
    raise exception 'Sign in with % to accept this invite', invitation_record.email;
  end if;

  if exists (select 1 from public.profiles p where p.id = actor_user_id) then
    raise exception 'This account already belongs to a workspace';
  end if;

  insert into public.profiles (
    id,
    business_id,
    role,
    email,
    display_name,
    is_active
  )
  values (
    actor_user_id,
    invitation_record.business_id,
    invitation_record.role,
    invitation_record.email,
    coalesce(
      nullif(btrim(coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', '')), ''),
      nullif(btrim(coalesce(auth.jwt() -> 'user_metadata' ->> 'name', '')), ''),
      split_part(invitation_record.email, '@', 1)
    ),
    true
  );

  update public.team_invitations
  set
    status = 'accepted',
    accepted_profile_id = actor_user_id
  where id = invitation_record.id;

  select invitation_record.business_id, b.name, invitation_record.role
  into business_id, business_name, member_role
  from public.businesses b
  where b.id = invitation_record.business_id;

  return next;
end;
$$;

create or replace function public.bootstrap_current_user_business(
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
  actor_email text;
  invite_id uuid;
  invite_business uuid;
  invite_role public.app_role;
begin
  if actor_user_id is null then
    raise exception 'Authentication required';
  end if;

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

  actor_email := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));

  if actor_email <> '' then
    select i.id, i.business_id, i.role
    into invite_id, invite_business, invite_role
    from public.team_invitations i
    where i.status = 'pending'
      and i.expires_at > now()
      and lower(i.email) = actor_email
    order by i.created_at desc
    limit 1;

    if invite_id is not null then
      insert into public.profiles (
        id,
        business_id,
        role,
        email,
        display_name,
        is_active
      )
      values (
        actor_user_id,
        invite_business,
        invite_role,
        actor_email,
        coalesce(
          nullif(btrim(coalesce(auth.jwt() -> 'user_metadata' ->> 'full_name', '')), ''),
          nullif(btrim(coalesce(auth.jwt() -> 'user_metadata' ->> 'name', '')), ''),
          split_part(actor_email, '@', 1)
        ),
        true
      );

      update public.team_invitations
      set
        status = 'accepted',
        accepted_profile_id = actor_user_id
      where id = invite_id;

      select invite_business, b.name, invite_role
      into business_id, business_name, member_role
      from public.businesses b
      where b.id = invite_business;

      return next;
      return;
    end if;
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

revoke all on function public.create_team_invitation(text, public.app_role, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.revoke_team_invitation(uuid)
  from public, anon, authenticated;
revoke all on function public.accept_team_invitation(text)
  from public, anon, authenticated;

grant execute on function public.create_team_invitation(text, public.app_role, text, timestamptz)
  to authenticated;
grant execute on function public.revoke_team_invitation(uuid)
  to authenticated;
grant execute on function public.accept_team_invitation(text)
  to authenticated;

comment on table public.team_invitations is
  'Pending email invites that attach a signed-in user to an existing business instead of creating a new one.';
comment on function public.create_team_invitation(text, public.app_role, text, timestamptz) is
  'Creates a hashed team invite for a co-owner or technician. The raw token never leaves the application runtime.';
comment on function public.accept_team_invitation(text) is
  'Attaches the authenticated user to the invited business when the email matches.';

commit;
