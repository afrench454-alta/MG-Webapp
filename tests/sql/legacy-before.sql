-- Synthetic data for the CI-only disposable database before the billing migration.
begin;
insert into auth.users (id,email)
values ('1aa00000-0000-4000-8000-000000000001','legacy@example.test');
insert into public.businesses (id,owner_user_id,name)
values ('1bb00000-0000-4000-8000-000000000001','1aa00000-0000-4000-8000-000000000001','Synthetic recovery business');
insert into public.clients (id,business_id,display_name)
values ('1cc00000-0000-4000-8000-000000000001','1bb00000-0000-4000-8000-000000000001','Synthetic legacy customer');
insert into public.jobs (id,business_id,client_id,title,status)
values ('1dd00000-0000-4000-8000-000000000001','1bb00000-0000-4000-8000-000000000001',
  '1cc00000-0000-4000-8000-000000000001','Synthetic legacy visit','completed');
insert into public.invoices (id,business_id,client_id,job_id,title)
values
  ('1ee00000-0000-4000-8000-000000000001','1bb00000-0000-4000-8000-000000000001',
   '1cc00000-0000-4000-8000-000000000001','1dd00000-0000-4000-8000-000000000001','Prior duplicate draft'),
  ('1ee00000-0000-4000-8000-000000000002','1bb00000-0000-4000-8000-000000000001',
   '1cc00000-0000-4000-8000-000000000001','1dd00000-0000-4000-8000-000000000001','Prior issued invoice');
insert into public.invoice_line_items (business_id,invoice_id,description,unit_price)
values
  ('1bb00000-0000-4000-8000-000000000001','1ee00000-0000-4000-8000-000000000001','Legacy draft line',200),
  ('1bb00000-0000-4000-8000-000000000001','1ee00000-0000-4000-8000-000000000002','Legacy issued line',200);
update public.invoices set document_status='issued'
where id='1ee00000-0000-4000-8000-000000000002';
insert into public.payments (id,business_id,invoice_id,amount,method,paid_at)
values ('1ff00000-0000-4000-8000-000000000001','1bb00000-0000-4000-8000-000000000001',
  '1ee00000-0000-4000-8000-000000000002',35,'cash','2026-11-17T10:00:00Z');
commit;
