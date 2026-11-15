-- Disposable local Supabase fixtures. All accounts use the test password
-- described below and all names and contacts are synthetic.
begin;

create temporary table local_demo_accounts (
  id uuid not null,
  email text not null,
  name text not null,
  business_id uuid not null,
  member_role public.app_role not null
) on commit drop;

insert into local_demo_accounts values
  ('ce000000-0000-4000-8000-000000000011', 'tenant-a-owner@example.test', 'Demo A Owner',
   'ce000000-0000-4000-8000-000000000001', 'owner'),
  ('ce000000-0000-4000-8000-000000000012', 'tenant-a-coowner@example.test', 'Demo A Co-owner',
   'ce000000-0000-4000-8000-000000000001', 'co_owner'),
  ('ce000000-0000-4000-8000-000000000013', 'tenant-a-tech@example.test', 'Demo A Technician',
   'ce000000-0000-4000-8000-000000000001', 'technician'),
  ('ce000000-0000-4000-8000-000000000021', 'tenant-b-owner@example.test', 'Demo B Owner',
   'ce000000-0000-4000-8000-000000000002', 'owner'),
  ('ce000000-0000-4000-8000-000000000022', 'tenant-b-coowner@example.test', 'Demo B Co-owner',
   'ce000000-0000-4000-8000-000000000002', 'co_owner'),
  ('ce000000-0000-4000-8000-000000000023', 'tenant-b-tech@example.test', 'Demo B Technician',
   'ce000000-0000-4000-8000-000000000002', 'technician');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, confirmation_token, recovery_token,
  email_change, email_change_token_new, created_at, updated_at
)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
  email, extensions.crypt('MowGlowLocalTest123!', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', name, 'full_name', name),
  '', '', '', '', now(), now()
from local_demo_accounts
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select id::text, id, 'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), now(), now()
from local_demo_accounts
on conflict (provider_id, provider) do nothing;

insert into public.businesses (id, owner_user_id, name)
values
  ('ce000000-0000-4000-8000-000000000001', 'ce000000-0000-4000-8000-000000000011', 'Demo Tenant A'),
  ('ce000000-0000-4000-8000-000000000002', 'ce000000-0000-4000-8000-000000000021', 'Demo Tenant B')
on conflict (id) do nothing;

insert into public.profiles (id, business_id, role, display_name, email)
select id, business_id, member_role, name, email
from local_demo_accounts
on conflict (id) do update
set display_name = excluded.display_name, email = excluded.email
where public.profiles.business_id = excluded.business_id
  and public.profiles.role = excluded.role;

commit;
