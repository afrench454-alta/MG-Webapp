create function public.set_bond_clean_extras()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if (new.form_schema->'fields' @> '[{"id":"extras"}]') is not true then
    return new;
  end if;

  select jsonb_set(new.form_schema, '{fields}', jsonb_agg(
    case when field->>'id' = 'extras' then
      jsonb_set(field, '{options}', '["Yard Maintenance","Minor Maintenance / Repairs","Carpet Cleaning","Pest Control","Pressure Cleaning","Rubbish Removal","Other"]')
    else field end order by position
  ) || '[{"id":"extras_description","label":"Describe the other service needed","type":"textarea","required":true,"showWhen":{"fieldId":"extras","option":"Other"}}]'::jsonb) into new.form_schema
  from jsonb_array_elements(new.form_schema->'fields') with ordinality as entry(field, position)
  where field->>'id' is distinct from 'extras_description';

  return new;
end;
$$;

create trigger set_bond_clean_extras
before insert on public.questionnaires
for each row when (new.name = 'Bond Clean / End of Lease')
execute function public.set_bond_clean_extras();

-- Use the same transformation for existing templates, including linked invitations.
create trigger update_bond_clean_extras
before update of form_schema on public.questionnaires
for each row when (new.name = 'Bond Clean / End of Lease')
execute function public.set_bond_clean_extras();

update public.questionnaires
set form_schema = form_schema
where name = 'Bond Clean / End of Lease'
  and form_schema->'fields' @> '[{"id":"extras"}]';

drop trigger update_bond_clean_extras on public.questionnaires;

create function public.validate_questionnaire_option_descriptions()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if exists (
    select 1
    from public.questionnaires q
    cross join lateral jsonb_array_elements(q.form_schema->'fields') as entry(field)
    where q.id = new.questionnaire_id
      and q.business_id = new.business_id
      and q.name = 'Bond Clean / End of Lease'
      and field->>'id' = 'extras_description'
      and (new.answers -> 'extras') @> '["Other"]'
      and (
        jsonb_typeof(new.answers -> 'extras_description') is distinct from 'string'
        or coalesce(new.answers ->> 'extras_description', '') !~ '[^[:space:]]'
      )
  ) then
    raise exception 'Describe the other service needed.';
  end if;
  return new;
end;
$$;

create trigger validate_questionnaire_option_descriptions
before insert on public.questionnaire_responses
for each row execute function public.validate_questionnaire_option_descriptions();

create function public.add_cleaning_intake_questions()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  questions jsonb;
begin
  if jsonb_typeof(new.form_schema->'fields') is distinct from 'array' then
    return new;
  end if;

  questions := '[
    {"id":"mould_present","label":"Is there mould anywhere in the property?","type":"radio","options":["Yes","No","Not sure"]},
    {"id":"property_furnished","label":"Is the property furnished?","type":"radio","options":["Yes","No","Partly furnished","Not sure"]}
  ]'::jsonb;

  if new.name = 'Bond Clean / End of Lease' then
    questions := '[{"id":"respondent_role","label":"Are you the:","type":"radio","options":["Tenant","Landlord","Agent"]}]'::jsonb
      || jsonb_insert(questions, '{1}', '{"id":"occupancy_duration","label":"How long have you or the tenants lived there?","type":"text"}');
    if new.introduction = 'Share the key property details so we can prepare an accurate bond-clean quote.' then
      new.introduction := 'Share the key property details so we can estimate your bond clean.';
    end if;
  end if;

  new.form_schema := jsonb_set(
    new.form_schema,
    '{fields}',
    (new.form_schema->'fields') || coalesce((
      select jsonb_agg(question order by position)
      from jsonb_array_elements(questions) with ordinality as entry(question, position)
      where not (new.form_schema->'fields' @> jsonb_build_array(jsonb_build_object('id', question->>'id')))
    ), '[]'::jsonb)
  );
  return new;
end;
$$;

create trigger add_cleaning_intake_questions
before insert on public.questionnaires
for each row when (new.name in ('Bond Clean / End of Lease', 'Standard / General Clean'))
execute function public.add_cleaning_intake_questions();

create trigger update_cleaning_intake_questions
before update of form_schema on public.questionnaires
for each row when (new.name in ('Bond Clean / End of Lease', 'Standard / General Clean'))
execute function public.add_cleaning_intake_questions();

update public.questionnaires
set form_schema = form_schema
where name in ('Bond Clean / End of Lease', 'Standard / General Clean');

drop trigger update_cleaning_intake_questions on public.questionnaires;
