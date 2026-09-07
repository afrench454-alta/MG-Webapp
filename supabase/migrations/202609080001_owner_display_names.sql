begin;

create or replace function public.provision_business_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_email text;
  owner_name text;
begin
  if exists (select 1 from public.profiles where id = new.owner_user_id) then
    raise exception 'This user already belongs to a business';
  end if;

  select
    nullif(btrim(coalesce(u.email, '')), ''),
    coalesce(
      nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
      nullif(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), ''),
      'Jodie'
    )
  into owner_email, owner_name
  from auth.users u
  where u.id = new.owner_user_id;

  insert into public.profiles (id, business_id, role, email, display_name)
  values (
    new.owner_user_id,
    new.id,
    'owner',
    owner_email,
    coalesce(nullif(btrim(coalesce(owner_name, '')), ''), 'Jodie')
  );

  insert into public.business_settings (business_id)
  values (new.id);

  insert into public.document_sequences (business_id, kind, prefix, next_number, padding)
  values
    (new.id, 'quote', 'Q-', 1, 5),
    (new.id, 'job', 'J-', 1, 5),
    (new.id, 'invoice', 'INV-', 1, 5);

  insert into public.document_templates (
    business_id,
    kind,
    name,
    is_default,
    header_text,
    footer_text,
    terms_text,
    payment_instructions
  )
  values
    (new.id, 'quote', 'Default quote', true, new.name, 'Thank you for the opportunity to quote.',
      'This quote is valid until the date shown.', null),
    (new.id, 'invoice', 'Default invoice', true, new.name, 'Thank you for your business.',
      null, 'Please use the invoice number as your payment reference.');

  return new;
end;
$$;

update public.profiles p
set
  email = coalesce(nullif(btrim(p.email), ''), u.email),
  display_name = coalesce(
    nullif(btrim(p.display_name), ''),
    nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), ''),
    case
      when p.role = 'owner' then 'Jodie'
      else null
    end,
    nullif(
      initcap(replace(split_part(coalesce(u.email, ''), '@', 1), '.', ' ')),
      ''
    )
  )
from auth.users u
where u.id = p.id
  and (
    p.display_name is null
    or btrim(p.display_name) = ''
    or p.email is null
    or btrim(p.email) = ''
  );

commit;
