-- Persistent job photos and practical questionnaire defaults.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('job-attachments', 'job-attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy job_attachment_objects_select_members
on storage.objects for select to authenticated
using (
  bucket_id = 'job-attachments'
  and (storage.foldername(name))[1] = public.current_business_id()::text
);

create policy job_attachment_objects_insert_authorised
on storage.objects for insert to authenticated
with check (
  bucket_id = 'job-attachments'
  and (storage.foldername(name))[1] = public.current_business_id()::text
  and (
    public.current_business_role() in ('owner', 'co_owner')
    or exists (
      select 1 from public.job_assignments assignment
      where assignment.business_id::text = (storage.foldername(name))[1]
        and assignment.job_id::text = (storage.foldername(name))[2]
        and assignment.profile_id = auth.uid()
    )
  )
);

create policy job_attachment_objects_delete_authorised
on storage.objects for delete to authenticated
using (
  bucket_id = 'job-attachments'
  and (storage.foldername(name))[1] = public.current_business_id()::text
  and (
    public.current_business_role() in ('owner', 'co_owner')
    or owner_id = auth.uid()::text
  )
);

create function public.provision_questionnaire_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.questionnaires (business_id, name, public_title, introduction, completion_message, status, form_schema, created_by)
  values
    (new.id, 'Standard / General Clean', 'Standard / General Clean Assessment', 'Tell us about the property and the cleaning result you need.', 'Thanks — we will review your answers and contact you shortly.', 'active', '{"fields":[{"id":"property_type","label":"Property type","type":"radio","required":true,"options":["Unit / apartment","House","Commercial","Other"]},{"id":"bedrooms","label":"Bedrooms or work areas","type":"text","required":true},{"id":"bathrooms","label":"Bathrooms","type":"text","required":true},{"id":"priorities","label":"Priority areas","type":"checkbox","options":["Kitchen","Bathrooms","Floors","Windows","Dusting"]},{"id":"pets","label":"Pets, access or parking notes","type":"textarea"},{"id":"details","label":"Anything else we should know?","type":"textarea"}]}'::jsonb, new.owner_user_id),
    (new.id, 'Bond Clean / End of Lease', 'Bond Clean / End of Lease Questionnaire', 'Share the key property details so we can prepare an accurate bond-clean quote.', 'Thanks — your bond-clean assessment has been received.', 'active', '{"fields":[{"id":"property","label":"Property type and size","type":"text","required":true},{"id":"vacate_date","label":"Vacate or handover date","type":"text","required":true},{"id":"condition","label":"Current condition","type":"radio","required":true,"options":["Light","Average","Heavy"]},{"id":"extras","label":"Extra services needed","type":"checkbox","options":["Carpets","Oven","Windows","Walls","Pest treatment"]},{"id":"access","label":"Access, keys and parking","type":"textarea"},{"id":"notes","label":"Agent requirements or other notes","type":"textarea"}]}'::jsonb, new.owner_user_id),
    (new.id, 'Yard Cleanup', 'Yard Cleanup & Property Overhaul', 'Help us understand the yard, access and green-waste requirements.', 'Thanks — your yard assessment has been received.', 'active', '{"fields":[{"id":"yard_size","label":"Approximate yard size","type":"text","required":true},{"id":"work","label":"Work required","type":"checkbox","required":true,"options":["Mowing","Edging","Pruning","Green waste","Weeding","Pressure cleaning"]},{"id":"access","label":"Access and equipment restrictions","type":"textarea"},{"id":"notes","label":"Anything else we should know?","type":"textarea"}]}'::jsonb, new.owner_user_id),
    (new.id, 'Property Maintenance', 'Property Maintenance & Repair', 'Describe the maintenance work, urgency and site access.', 'Thanks — your maintenance request has been received.', 'active', '{"fields":[{"id":"work","label":"Work or repair required","type":"textarea","required":true},{"id":"urgency","label":"Urgency","type":"radio","required":true,"options":["Routine","Soon","Urgent"]},{"id":"access","label":"Access, safety or material notes","type":"textarea"}]}'::jsonb, new.owner_user_id);
  return new;
end;
$$;

create trigger businesses_provision_questionnaires
after insert on public.businesses
for each row execute function public.provision_questionnaire_defaults();

insert into public.questionnaires (business_id, name, public_title, introduction, completion_message, status, form_schema, created_by)
select business.id, template.name, template.public_title, template.introduction, template.completion_message, 'active'::public.questionnaire_status, template.form_schema, business.owner_user_id
from public.businesses business
cross join (
  values
    ('Standard / General Clean', 'Standard / General Clean Assessment', 'Tell us about the property and the cleaning result you need.', 'Thanks — we will review your answers and contact you shortly.', '{"fields":[{"id":"property_type","label":"Property type","type":"radio","required":true,"options":["Unit / apartment","House","Commercial","Other"]},{"id":"bedrooms","label":"Bedrooms or work areas","type":"text","required":true},{"id":"bathrooms","label":"Bathrooms","type":"text","required":true},{"id":"priorities","label":"Priority areas","type":"checkbox","options":["Kitchen","Bathrooms","Floors","Windows","Dusting"]},{"id":"pets","label":"Pets, access or parking notes","type":"textarea"},{"id":"details","label":"Anything else we should know?","type":"textarea"}]}'::jsonb),
    ('Bond Clean / End of Lease', 'Bond Clean / End of Lease Questionnaire', 'Share the key property details so we can prepare an accurate bond-clean quote.', 'Thanks — your bond-clean assessment has been received.', '{"fields":[{"id":"property","label":"Property type and size","type":"text","required":true},{"id":"vacate_date","label":"Vacate or handover date","type":"text","required":true},{"id":"condition","label":"Current condition","type":"radio","required":true,"options":["Light","Average","Heavy"]},{"id":"extras","label":"Extra services needed","type":"checkbox","options":["Carpets","Oven","Windows","Walls","Pest treatment"]},{"id":"access","label":"Access, keys and parking","type":"textarea"},{"id":"notes","label":"Agent requirements or other notes","type":"textarea"}]}'::jsonb),
    ('Yard Cleanup', 'Yard Cleanup & Property Overhaul', 'Help us understand the yard, access and green-waste requirements.', 'Thanks — your yard assessment has been received.', '{"fields":[{"id":"yard_size","label":"Approximate yard size","type":"text","required":true},{"id":"work","label":"Work required","type":"checkbox","required":true,"options":["Mowing","Edging","Pruning","Green waste","Weeding","Pressure cleaning"]},{"id":"access","label":"Access and equipment restrictions","type":"textarea"},{"id":"notes","label":"Anything else we should know?","type":"textarea"}]}'::jsonb),
    ('Property Maintenance', 'Property Maintenance & Repair', 'Describe the maintenance work, urgency and site access.', 'Thanks — your maintenance request has been received.', '{"fields":[{"id":"work","label":"Work or repair required","type":"textarea","required":true},{"id":"urgency","label":"Urgency","type":"radio","required":true,"options":["Routine","Soon","Urgent"]},{"id":"access","label":"Access, safety or material notes","type":"textarea"}]}'::jsonb)
) as template(name, public_title, introduction, completion_message, form_schema)
where not exists (
  select 1 from public.questionnaires existing
  where existing.business_id = business.id
    and existing.name = template.name
);

revoke all on function public.provision_questionnaire_defaults() from public, anon, authenticated;
