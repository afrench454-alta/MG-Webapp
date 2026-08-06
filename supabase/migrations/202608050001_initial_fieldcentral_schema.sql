begin;

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('owner', 'co_owner', 'technician');
create type public.document_kind as enum ('quote', 'job', 'invoice');
create type public.client_kind as enum ('business', 'individual');
create type public.address_kind as enum ('service', 'billing', 'postal', 'other');
create type public.questionnaire_status as enum ('draft', 'active', 'archived');
create type public.questionnaire_invitation_status as enum (
  'draft',
  'queued',
  'sent',
  'opened',
  'submitted',
  'expired',
  'revoked',
  'delivery_failed'
);
create type public.job_request_status as enum ('new', 'qualified', 'quoting', 'scheduled', 'closed', 'rejected');
create type public.quote_status as enum ('draft', 'sent', 'approved', 'declined', 'expired', 'void');
create type public.job_status as enum ('unscheduled', 'scheduled', 'in_progress', 'paused', 'completed', 'cancelled');
create type public.priority_level as enum ('low', 'normal', 'high', 'urgent');
create type public.recurrence_frequency as enum ('daily', 'weekly', 'monthly', 'yearly', 'custom');
create type public.invoice_document_status as enum ('draft', 'issued', 'sent', 'overdue', 'void');
create type public.invoice_payment_status as enum ('unpaid', 'partially_paid', 'paid', 'refunded');
create type public.payment_record_status as enum ('recorded', 'voided', 'refunded');
create type public.payment_method as enum ('cash', 'bank_transfer', 'card_external', 'cheque', 'other');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  legal_name text,
  slug text unique check (slug is null or slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  abn text,
  email text,
  phone text,
  website text,
  logo_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  role public.app_role not null default 'technician',
  display_name text,
  email text,
  phone text,
  avatar_storage_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.business_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  timezone text not null default 'Australia/Brisbane',
  locale text not null default 'en-AU',
  currency_code text not null default 'AUD' check (currency_code ~ '^[A-Z]{3}$'),
  tax_label text not null default 'GST',
  default_tax_rate numeric(5, 2) not null default 10.00 check (default_tax_rate between 0 and 100),
  default_quote_valid_days integer not null default 30 check (default_quote_valid_days between 1 and 365),
  default_invoice_due_days integer not null default 14 check (default_invoice_due_days between 0 and 365),
  email_reply_to text,
  working_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(working_hours) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.document_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.document_kind not null,
  name text not null,
  is_default boolean not null default true,
  primary_colour text not null default '#173F35' check (primary_colour ~ '^#[0-9A-Fa-f]{6}$'),
  accent_colour text not null default '#D9F36A' check (accent_colour ~ '^#[0-9A-Fa-f]{6}$'),
  logo_storage_path text,
  header_text text,
  footer_text text,
  terms_text text,
  payment_instructions text,
  show_tax_breakdown boolean not null default true,
  show_item_quantities boolean not null default true,
  layout_options jsonb not null default '{}'::jsonb check (jsonb_typeof(layout_options) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, kind, name),
  unique (id, business_id)
);

create unique index document_templates_one_default_per_kind
  on public.document_templates (business_id, kind)
  where is_default;

create table public.document_sequences (
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.document_kind not null,
  prefix text not null,
  next_number bigint not null default 1 check (next_number > 0),
  padding smallint not null default 5 check (padding between 1 and 12),
  updated_at timestamptz not null default now(),
  primary key (business_id, kind)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind public.client_kind not null default 'individual',
  display_name text not null check (char_length(btrim(display_name)) between 1 and 200),
  legal_name text,
  email text,
  phone text,
  abn text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  client_id uuid not null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 160),
  email text,
  phone text,
  position_title text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete cascade,
  unique (id, business_id),
  unique (id, client_id, business_id)
);

create unique index client_contacts_one_primary
  on public.client_contacts (business_id, client_id)
  where is_primary;

create table public.client_addresses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  client_id uuid not null,
  kind public.address_kind not null default 'service',
  label text,
  line_1 text not null,
  line_2 text,
  suburb text,
  state_region text,
  postcode text,
  country_code text not null default 'AU' check (country_code ~ '^[A-Z]{2}$'),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  access_notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete cascade,
  check (latitude is null or latitude between -90 and 90),
  check (longitude is null or longitude between -180 and 180),
  unique (id, business_id),
  unique (id, client_id, business_id)
);

create unique index client_addresses_one_primary_per_kind
  on public.client_addresses (business_id, client_id, kind)
  where is_primary;

create table public.questionnaires (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  public_title text not null,
  introduction text,
  completion_message text,
  status public.questionnaire_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  form_schema jsonb not null default '{"fields":[]}'::jsonb check (jsonb_typeof(form_schema) = 'object'),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create table public.questionnaire_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  questionnaire_id uuid not null,
  client_id uuid,
  sent_to_email text,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  status public.questionnaire_invitation_status not null default 'draft',
  expires_at timestamptz not null default (now() + interval '30 days'),
  sent_at timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  delivery_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (questionnaire_id, business_id) references public.questionnaires (id, business_id) on delete cascade,
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete set null (client_id),
  unique (id, business_id)
);

create table public.questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  questionnaire_id uuid not null,
  invitation_id uuid not null unique,
  client_id uuid,
  respondent_name text,
  respondent_email text,
  respondent_phone text,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (questionnaire_id, business_id) references public.questionnaires (id, business_id) on delete restrict,
  foreign key (invitation_id, business_id) references public.questionnaire_invitations (id, business_id) on delete restrict,
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete set null (client_id),
  unique (id, business_id)
);

create table public.job_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  client_id uuid,
  client_contact_id uuid,
  service_address_id uuid,
  questionnaire_response_id uuid,
  status public.job_request_status not null default 'new',
  priority public.priority_level not null default 'normal',
  title text not null check (char_length(btrim(title)) between 1 and 220),
  description text,
  preferred_schedule jsonb not null default '{}'::jsonb check (jsonb_typeof(preferred_schedule) = 'object'),
  service_address_snapshot jsonb check (service_address_snapshot is null or jsonb_typeof(service_address_snapshot) = 'object'),
  source text not null default 'manual' check (source in ('manual', 'questionnaire', 'phone', 'email', 'other')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete set null (client_id),
  foreign key (client_contact_id, client_id, business_id)
    references public.client_contacts (id, client_id, business_id) on delete set null (client_contact_id),
  foreign key (service_address_id, client_id, business_id)
    references public.client_addresses (id, client_id, business_id) on delete set null (service_address_id),
  foreign key (questionnaire_response_id, business_id)
    references public.questionnaire_responses (id, business_id) on delete set null (questionnaire_response_id),
  check (client_contact_id is null or client_id is not null),
  check (service_address_id is null or client_id is not null),
  unique (questionnaire_response_id),
  unique (id, business_id)
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_number text,
  client_id uuid not null,
  client_contact_id uuid,
  service_address_id uuid,
  job_request_id uuid,
  template_id uuid,
  status public.quote_status not null default 'draft',
  title text not null,
  issue_date date not null default current_date,
  valid_until date,
  customer_message text,
  internal_notes text,
  terms_text text,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  tax_total numeric(12, 2) not null default 0 check (tax_total >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  pdf_storage_path text,
  sent_at timestamptz,
  approved_at timestamptz,
  declined_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete restrict,
  foreign key (client_contact_id, client_id, business_id)
    references public.client_contacts (id, client_id, business_id) on delete set null (client_contact_id),
  foreign key (service_address_id, client_id, business_id)
    references public.client_addresses (id, client_id, business_id) on delete set null (service_address_id),
  foreign key (job_request_id, business_id)
    references public.job_requests (id, business_id) on delete set null (job_request_id),
  foreign key (template_id, business_id)
    references public.document_templates (id, business_id) on delete set null (template_id),
  check (valid_until is null or valid_until >= issue_date),
  unique (business_id, document_number),
  unique (id, business_id)
);

create table public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  quote_id uuid not null,
  position integer not null default 0 check (position >= 0),
  label text,
  description text not null,
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit_label text not null default 'item',
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  tax_rate numeric(5, 2) not null default 10.00 check (tax_rate between 0 and 100),
  line_subtotal numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  tax_amount numeric(12, 2) generated always as (round((quantity * unit_price) * tax_rate / 100, 2)) stored,
  line_total numeric(12, 2) generated always as (
    round(quantity * unit_price, 2) + round((quantity * unit_price) * tax_rate / 100, 2)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (quote_id, business_id) references public.quotes (id, business_id) on delete cascade,
  unique (id, business_id),
  unique (quote_id, position)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_number text,
  client_id uuid not null,
  client_contact_id uuid,
  service_address_id uuid,
  quote_id uuid,
  job_request_id uuid,
  recurrence_parent_job_id uuid,
  recurrence_instance_date date,
  status public.job_status not null default 'unscheduled',
  priority public.priority_level not null default 'normal',
  title text not null check (char_length(btrim(title)) between 1 and 220),
  scope_of_work text,
  internal_instructions text,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  schedule_timezone text not null default 'Australia/Brisbane',
  actual_started_at timestamptz,
  actual_completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete restrict,
  foreign key (client_contact_id, client_id, business_id)
    references public.client_contacts (id, client_id, business_id) on delete set null (client_contact_id),
  foreign key (service_address_id, client_id, business_id)
    references public.client_addresses (id, client_id, business_id) on delete set null (service_address_id),
  foreign key (quote_id, business_id)
    references public.quotes (id, business_id) on delete set null (quote_id),
  foreign key (job_request_id, business_id)
    references public.job_requests (id, business_id) on delete set null (job_request_id),
  foreign key (recurrence_parent_job_id, business_id)
    references public.jobs (id, business_id) on delete set null (recurrence_parent_job_id),
  check (
    (scheduled_start is null and scheduled_end is null)
    or (scheduled_start is not null and scheduled_end is not null and scheduled_end > scheduled_start)
  ),
  check (actual_completed_at is null or actual_started_at is null or actual_completed_at >= actual_started_at),
  unique (business_id, document_number),
  unique (quote_id),
  unique (id, business_id)
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  job_id uuid not null,
  profile_id uuid not null,
  is_lead boolean not null default false,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null,
  foreign key (job_id, business_id) references public.jobs (id, business_id) on delete cascade,
  foreign key (profile_id, business_id) references public.profiles (id, business_id) on delete cascade,
  unique (job_id, profile_id),
  unique (id, business_id)
);

create unique index job_assignments_one_lead
  on public.job_assignments (business_id, job_id)
  where is_lead;

create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  job_id uuid not null,
  body text not null check (char_length(btrim(body)) > 0),
  is_customer_visible boolean not null default false,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (job_id, business_id) references public.jobs (id, business_id) on delete cascade,
  unique (id, business_id)
);

create table public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  job_id uuid not null,
  storage_bucket text not null default 'job-attachments',
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  caption text,
  uploaded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (job_id, business_id) references public.jobs (id, business_id) on delete cascade,
  unique (storage_bucket, storage_path),
  unique (id, business_id)
);

create table public.job_recurrences (
  job_id uuid primary key,
  business_id uuid not null,
  frequency public.recurrence_frequency not null,
  interval_count integer not null default 1 check (interval_count between 1 and 999),
  by_weekday smallint[],
  by_month_day smallint check (by_month_day is null or by_month_day between 1 and 31),
  custom_rrule text,
  starts_on date not null,
  ends_on date,
  max_occurrences integer check (max_occurrences is null or max_occurrences > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (job_id, business_id) references public.jobs (id, business_id) on delete cascade,
  check (by_weekday is null or by_weekday <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  check (ends_on is null or ends_on >= starts_on),
  check (frequency <> 'custom' or (custom_rrule is not null and char_length(btrim(custom_rrule)) > 0)),
  unique (job_id, business_id)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  document_number text,
  client_id uuid not null,
  client_contact_id uuid,
  billing_address_id uuid,
  quote_id uuid,
  job_id uuid,
  template_id uuid,
  document_status public.invoice_document_status not null default 'draft',
  payment_status public.invoice_payment_status not null default 'unpaid',
  title text not null,
  issue_date date not null default current_date,
  due_date date,
  customer_message text,
  internal_notes text,
  payment_instructions text,
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  tax_total numeric(12, 2) not null default 0 check (tax_total >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),
  amount_paid numeric(12, 2) not null default 0 check (amount_paid >= 0),
  balance_due numeric(12, 2) generated always as (greatest(total - amount_paid, 0)) stored,
  pdf_storage_path text,
  issued_at timestamptz,
  sent_at timestamptz,
  voided_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, business_id) references public.clients (id, business_id) on delete restrict,
  foreign key (client_contact_id, client_id, business_id)
    references public.client_contacts (id, client_id, business_id) on delete set null (client_contact_id),
  foreign key (billing_address_id, client_id, business_id)
    references public.client_addresses (id, client_id, business_id) on delete set null (billing_address_id),
  foreign key (quote_id, business_id)
    references public.quotes (id, business_id) on delete set null (quote_id),
  foreign key (job_id, business_id)
    references public.jobs (id, business_id) on delete set null (job_id),
  foreign key (template_id, business_id)
    references public.document_templates (id, business_id) on delete set null (template_id),
  check (due_date is null or due_date >= issue_date),
  unique (business_id, document_number),
  unique (id, business_id)
);

create table public.invoice_line_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  invoice_id uuid not null,
  position integer not null default 0 check (position >= 0),
  label text,
  description text not null,
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit_label text not null default 'item',
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  tax_rate numeric(5, 2) not null default 10.00 check (tax_rate between 0 and 100),
  line_subtotal numeric(12, 2) generated always as (round(quantity * unit_price, 2)) stored,
  tax_amount numeric(12, 2) generated always as (round((quantity * unit_price) * tax_rate / 100, 2)) stored,
  line_total numeric(12, 2) generated always as (
    round(quantity * unit_price, 2) + round((quantity * unit_price) * tax_rate / 100, 2)
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete cascade,
  unique (id, business_id),
  unique (invoice_id, position)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  invoice_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  method public.payment_method not null,
  status public.payment_record_status not null default 'recorded',
  paid_at timestamptz not null default now(),
  reference text,
  notes text,
  recorded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (invoice_id, business_id) references public.invoices (id, business_id) on delete restrict,
  unique (id, business_id)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changes jsonb not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  request_id text,
  occurred_at timestamptz not null default now()
);

create index profiles_business_role_idx on public.profiles (business_id, role) where is_active;
create index clients_business_name_idx on public.clients (business_id, lower(display_name)) where is_active;
create index contacts_client_idx on public.client_contacts (business_id, client_id);
create index addresses_client_idx on public.client_addresses (business_id, client_id);
create index questionnaires_business_status_idx on public.questionnaires (business_id, status);
create index questionnaire_invitations_business_status_idx
  on public.questionnaire_invitations (business_id, status, created_at desc);
create index questionnaire_invitations_expiry_idx
  on public.questionnaire_invitations (expires_at)
  where status in ('draft', 'queued', 'sent', 'opened');
create index questionnaire_responses_business_submitted_idx
  on public.questionnaire_responses (business_id, submitted_at desc);
create index job_requests_business_status_idx on public.job_requests (business_id, status, created_at desc);
create index quotes_business_status_idx on public.quotes (business_id, status, issue_date desc);
create index quotes_client_idx on public.quotes (business_id, client_id, created_at desc);
create index quote_line_items_quote_idx on public.quote_line_items (quote_id, position);
create index jobs_business_status_idx on public.jobs (business_id, status, scheduled_start);
create index jobs_business_schedule_idx on public.jobs (business_id, scheduled_start, scheduled_end)
  where status not in ('completed', 'cancelled');
create index jobs_client_idx on public.jobs (business_id, client_id, created_at desc);
create index jobs_recurrence_parent_idx on public.jobs (business_id, recurrence_parent_job_id)
  where recurrence_parent_job_id is not null;
create index job_assignments_profile_idx on public.job_assignments (business_id, profile_id, job_id);
create index job_notes_job_idx on public.job_notes (business_id, job_id, created_at desc);
create index job_attachments_job_idx on public.job_attachments (business_id, job_id, created_at desc);
create index invoices_business_document_status_idx
  on public.invoices (business_id, document_status, issue_date desc);
create index invoices_business_payment_status_idx
  on public.invoices (business_id, payment_status, due_date);
create index invoices_client_idx on public.invoices (business_id, client_id, created_at desc);
create index invoice_line_items_invoice_idx on public.invoice_line_items (invoice_id, position);
create index payments_invoice_idx on public.payments (business_id, invoice_id, paid_at desc);
create index audit_events_business_time_idx on public.audit_events (business_id, occurred_at desc);
create index audit_events_entity_idx on public.audit_events (business_id, entity_type, entity_id, occurred_at desc);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function public.provision_business_defaults()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.profiles where id = new.owner_user_id) then
    raise exception 'This user already belongs to a business';
  end if;

  insert into public.profiles (id, business_id, role)
  values (new.owner_user_id, new.id, 'owner');

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

create trigger businesses_provision_defaults
after insert on public.businesses
for each row execute function public.provision_business_defaults();

create function public.current_business_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.business_id
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
  limit 1
$$;

create function public.current_business_role()
returns public.app_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
  limit 1
$$;

create function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.business_id = target_business_id
      and p.is_active
  )
$$;

create function public.can_manage_business(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.business_id = target_business_id
      and p.is_active
      and p.role in ('owner', 'co_owner')
  )
$$;

create function public.is_assigned_to_job(target_job_id uuid, target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.job_assignments a
    join public.profiles p
      on p.id = a.profile_id
     and p.business_id = a.business_id
    where a.job_id = target_job_id
      and a.business_id = target_business_id
      and p.id = auth.uid()
      and p.is_active
  )
$$;

create function public.guard_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_owner uuid;
begin
  if tg_op = 'DELETE' then
    select b.owner_user_id into target_owner
    from public.businesses b
    where b.id = old.business_id;

    if old.id = target_owner then
      raise exception 'The business owner profile cannot be deleted';
    end if;
    return old;
  end if;

  if new.id is distinct from old.id then
    raise exception 'A profile user id cannot be changed';
  end if;

  if new.business_id is distinct from old.business_id then
    raise exception 'A profile cannot be moved between businesses';
  end if;

  if new.role is distinct from old.role
     and not public.can_manage_business(old.business_id) then
    raise exception 'Only an owner or co-owner can change member roles';
  end if;

  select b.owner_user_id into target_owner
  from public.businesses b
  where b.id = old.business_id;

  if old.id = target_owner and new.role <> 'owner' then
    raise exception 'The primary business owner must keep the owner role';
  end if;

  if new.role = 'owner'
     and old.role <> 'owner'
     and auth.uid() is distinct from target_owner then
    raise exception 'Only the primary owner can grant the owner role';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_security_update
before update on public.profiles
for each row execute function public.guard_profile_security_fields();

create trigger profiles_guard_security_delete
before delete on public.profiles
for each row execute function public.guard_profile_security_fields();

create function public.guard_business_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Owner transfer requires a dedicated audited workflow';
  end if;
  return new;
end;
$$;

create trigger businesses_guard_owner
before update on public.businesses
for each row execute function public.guard_business_owner();

create function public.assign_document_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  sequence_kind public.document_kind := tg_argv[0]::public.document_kind;
  issued_number text;
begin
  if new.document_number is null or btrim(new.document_number) = '' then
    insert into public.document_sequences (business_id, kind, prefix, next_number, padding)
    values (
      new.business_id,
      sequence_kind,
      case sequence_kind when 'quote' then 'Q-' when 'job' then 'J-' else 'INV-' end,
      1,
      5
    )
    on conflict (business_id, kind) do nothing;

    update public.document_sequences
    set next_number = next_number + 1,
        updated_at = now()
    where business_id = new.business_id
      and kind = sequence_kind
    returning prefix || lpad((next_number - 1)::text, padding, '0') into issued_number;

    if issued_number is null then
      raise exception 'Unable to allocate a % number', sequence_kind;
    end if;

    new.document_number := issued_number;
  end if;

  return new;
end;
$$;

create trigger quotes_assign_document_number
before insert on public.quotes
for each row execute function public.assign_document_number('quote');

create trigger jobs_assign_document_number
before insert on public.jobs
for each row execute function public.assign_document_number('job');

create trigger invoices_assign_document_number
before insert on public.invoices
for each row execute function public.assign_document_number('invoice');

create function public.sync_quote_status_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'sent' and old.status is distinct from new.status then
    new.sent_at := coalesce(new.sent_at, now());
  elsif new.status = 'approved' and old.status is distinct from new.status then
    new.approved_at := coalesce(new.approved_at, now());
  elsif new.status = 'declined' and old.status is distinct from new.status then
    new.declined_at := coalesce(new.declined_at, now());
  end if;
  return new;
end;
$$;

create trigger quotes_sync_status_timestamps
before update on public.quotes
for each row execute function public.sync_quote_status_timestamps();

create function public.sync_job_status_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'in_progress' and old.status is distinct from new.status then
    new.actual_started_at := coalesce(new.actual_started_at, now());
  elsif new.status = 'completed' and old.status is distinct from new.status then
    new.actual_completed_at := coalesce(new.actual_completed_at, now());
  end if;
  return new;
end;
$$;

create trigger jobs_sync_status_timestamps
before update on public.jobs
for each row execute function public.sync_job_status_timestamps();

create function public.sync_invoice_status_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.document_status = 'issued' and old.document_status is distinct from new.document_status then
    new.issued_at := coalesce(new.issued_at, now());
  elsif new.document_status = 'sent' and old.document_status is distinct from new.document_status then
    new.issued_at := coalesce(new.issued_at, now());
    new.sent_at := coalesce(new.sent_at, now());
  elsif new.document_status = 'void' and old.document_status is distinct from new.document_status then
    new.voided_at := coalesce(new.voided_at, now());
  end if;
  return new;
end;
$$;

create trigger invoices_sync_status_timestamps
before update on public.invoices
for each row execute function public.sync_invoice_status_timestamps();

create function public.guard_quote_derived_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.subtotal := 0;
    new.tax_total := 0;
    new.total := 0;
  elsif pg_trigger_depth() = 1 and (
    new.subtotal is distinct from old.subtotal
    or new.tax_total is distinct from old.tax_total
    or new.total is distinct from old.total
  ) then
    raise exception 'Quote totals are derived from line items';
  end if;
  return new;
end;
$$;

create function public.guard_invoice_derived_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.subtotal := 0;
    new.tax_total := 0;
    new.total := 0;
    new.amount_paid := 0;
    new.payment_status := 'unpaid';
  elsif pg_trigger_depth() = 1 and (
    new.subtotal is distinct from old.subtotal
    or new.tax_total is distinct from old.tax_total
    or new.total is distinct from old.total
    or new.amount_paid is distinct from old.amount_paid
    or new.payment_status is distinct from old.payment_status
  ) then
    raise exception 'Invoice totals and payment status are derived from line items and payment records';
  end if;
  return new;
end;
$$;

create trigger quotes_guard_derived_fields
before insert or update on public.quotes
for each row execute function public.guard_quote_derived_fields();

create trigger invoices_guard_derived_fields
before insert or update on public.invoices
for each row execute function public.guard_invoice_derived_fields();

create function public.validate_document_template_kind()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  expected_kind public.document_kind := tg_argv[0]::public.document_kind;
  actual_kind public.document_kind;
begin
  if new.template_id is null then
    return new;
  end if;

  select t.kind into actual_kind
  from public.document_templates t
  where t.id = new.template_id
    and t.business_id = new.business_id;

  if actual_kind is distinct from expected_kind then
    raise exception 'The selected template is not a % template', expected_kind;
  end if;

  return new;
end;
$$;

create trigger quotes_validate_template_kind
before insert or update of template_id, business_id on public.quotes
for each row execute function public.validate_document_template_kind('quote');

create trigger invoices_validate_template_kind
before insert or update of template_id, business_id on public.invoices
for each row execute function public.validate_document_template_kind('invoice');

create function public.recalculate_quote_totals(target_quote_id uuid, target_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_subtotal numeric(12, 2);
  next_tax_total numeric(12, 2);
  next_total numeric(12, 2);
begin
  select
    coalesce(sum(li.line_subtotal), 0),
    coalesce(sum(li.tax_amount), 0),
    coalesce(sum(li.line_total), 0)
  into next_subtotal, next_tax_total, next_total
  from public.quote_line_items li
  where li.quote_id = target_quote_id
    and li.business_id = target_business_id;

  update public.quotes
  set subtotal = next_subtotal,
      tax_total = next_tax_total,
      total = next_total
  where id = target_quote_id
    and business_id = target_business_id;
end;
$$;

create function public.recalculate_quote_after_line_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_quote_totals(old.quote_id, old.business_id);
    return old;
  end if;

  perform public.recalculate_quote_totals(new.quote_id, new.business_id);
  if tg_op = 'UPDATE'
     and (old.quote_id, old.business_id) is distinct from (new.quote_id, new.business_id) then
    perform public.recalculate_quote_totals(old.quote_id, old.business_id);
  end if;
  return new;
end;
$$;

create trigger quote_line_items_recalculate_quote
after insert or update or delete on public.quote_line_items
for each row execute function public.recalculate_quote_after_line_change();

create function public.recalculate_invoice_totals(target_invoice_id uuid, target_business_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  next_subtotal numeric(12, 2);
  next_tax_total numeric(12, 2);
  next_total numeric(12, 2);
  next_amount_paid numeric(12, 2);
  has_refund boolean;
  next_payment_status public.invoice_payment_status;
begin
  select
    coalesce(sum(li.line_subtotal), 0),
    coalesce(sum(li.tax_amount), 0),
    coalesce(sum(li.line_total), 0)
  into next_subtotal, next_tax_total, next_total
  from public.invoice_line_items li
  where li.invoice_id = target_invoice_id
    and li.business_id = target_business_id;

  select
    coalesce(sum(p.amount) filter (where p.status = 'recorded'), 0),
    coalesce(bool_or(p.status = 'refunded'), false)
  into next_amount_paid, has_refund
  from public.payments p
  where p.invoice_id = target_invoice_id
    and p.business_id = target_business_id;

  next_payment_status := case
    when next_amount_paid >= next_total and next_total > 0 then 'paid'::public.invoice_payment_status
    when next_amount_paid > 0 then 'partially_paid'::public.invoice_payment_status
    when has_refund then 'refunded'::public.invoice_payment_status
    else 'unpaid'::public.invoice_payment_status
  end;

  update public.invoices
  set subtotal = next_subtotal,
      tax_total = next_tax_total,
      total = next_total,
      amount_paid = next_amount_paid,
      payment_status = next_payment_status
  where id = target_invoice_id
    and business_id = target_business_id;
end;
$$;

create function public.recalculate_invoice_after_child_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_invoice_totals(old.invoice_id, old.business_id);
    return old;
  end if;

  perform public.recalculate_invoice_totals(new.invoice_id, new.business_id);
  if tg_op = 'UPDATE'
     and (old.invoice_id, old.business_id) is distinct from (new.invoice_id, new.business_id) then
    perform public.recalculate_invoice_totals(old.invoice_id, old.business_id);
  end if;
  return new;
end;
$$;

create trigger invoice_line_items_recalculate_invoice
after insert or update or delete on public.invoice_line_items
for each row execute function public.recalculate_invoice_after_child_change();

create trigger payments_recalculate_invoice
after insert or update or delete on public.payments
for each row execute function public.recalculate_invoice_after_child_change();

create function public.guard_questionnaire_response_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if (to_jsonb(new) - 'client_id') is distinct from (to_jsonb(old) - 'client_id') then
    raise exception 'Submitted questionnaire answers are immutable; only the linked client may change';
  end if;
  return new;
end;
$$;

create trigger questionnaire_responses_guard_update
before update on public.questionnaire_responses
for each row execute function public.guard_questionnaire_response_update();

create function public.guard_job_note_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.business_id is distinct from old.business_id
    or new.job_id is distinct from old.job_id
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Job note ownership and job linkage are immutable';
  end if;

  if public.current_business_role() = 'technician' and new.is_customer_visible then
    raise exception 'Technician notes must remain internal';
  end if;

  return new;
end;
$$;

create trigger job_notes_guard_write
before insert or update on public.job_notes
for each row execute function public.guard_job_note_write();

create function public.guard_technician_job_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_role public.app_role;
begin
  if new.business_id is distinct from old.business_id then
    raise exception 'A job cannot be moved between businesses';
  end if;

  actor_role := public.current_business_role();
  if actor_role is distinct from 'technician' then
    return new;
  end if;

  if not public.is_assigned_to_job(old.id, old.business_id) then
    raise exception 'Technicians can only update jobs assigned to them';
  end if;

  if (to_jsonb(new) - array['status', 'actual_started_at', 'actual_completed_at', 'updated_at'])
     is distinct from
     (to_jsonb(old) - array['status', 'actual_started_at', 'actual_completed_at', 'updated_at']) then
    raise exception 'Technicians may only update job execution status and actual timestamps';
  end if;

  if old.status is distinct from new.status and not (
    (old.status in ('unscheduled', 'scheduled') and new.status = 'in_progress')
    or (old.status = 'in_progress' and new.status in ('paused', 'completed'))
    or (old.status = 'paused' and new.status in ('in_progress', 'completed'))
  ) then
    raise exception 'This job status transition is not available to technicians';
  end if;

  return new;
end;
$$;

create trigger jobs_guard_technician_update
before update on public.jobs
for each row execute function public.guard_technician_job_update();

create function public.create_questionnaire_invitation(
  target_business_id uuid,
  target_questionnaire_id uuid,
  raw_token text,
  target_email text default null,
  target_client_id uuid default null,
  target_expires_at timestamptz default (now() + interval '30 days')
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  invitation_id uuid;
begin
  if not public.can_manage_business(target_business_id) then
    raise exception 'Not authorised to create questionnaire invitations';
  end if;

  if char_length(raw_token) < 32 then
    raise exception 'Invitation tokens must contain at least 32 characters';
  end if;

  if target_expires_at <= now() then
    raise exception 'Invitation expiry must be in the future';
  end if;

  insert into public.questionnaire_invitations (
    business_id,
    questionnaire_id,
    client_id,
    sent_to_email,
    token_hash,
    status,
    expires_at,
    sent_at,
    created_by
  )
  values (
    target_business_id,
    target_questionnaire_id,
    target_client_id,
    nullif(btrim(target_email), ''),
    encode(digest(raw_token, 'sha256'), 'hex'),
    'sent',
    target_expires_at,
    now(),
    auth.uid()
  )
  returning id into invitation_id;

  return invitation_id;
end;
$$;

create function public.get_public_questionnaire(raw_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  token_digest text;
  invitation_record public.questionnaire_invitations%rowtype;
  public_payload jsonb;
begin
  token_digest := encode(digest(raw_token, 'sha256'), 'hex');

  select i.* into invitation_record
  from public.questionnaire_invitations i
  where i.token_hash = token_digest
  for update;

  if not found
     or invitation_record.status in ('revoked', 'expired', 'delivery_failed')
     or invitation_record.expires_at <= now() then
    if found and invitation_record.expires_at <= now() and invitation_record.status not in ('submitted', 'revoked') then
      update public.questionnaire_invitations
      set status = 'expired'
      where id = invitation_record.id;
    end if;
    return null;
  end if;

  if invitation_record.status = 'submitted' then
    return jsonb_build_object('already_submitted', true);
  end if;

  update public.questionnaire_invitations
  set status = case when status in ('draft', 'queued', 'sent') then 'opened' else status end,
      opened_at = coalesce(opened_at, now())
  where id = invitation_record.id;

  select jsonb_build_object(
    'already_submitted', false,
    'expires_at', invitation_record.expires_at,
    'business', jsonb_build_object('name', b.name, 'logo_storage_path', b.logo_storage_path),
    'questionnaire', jsonb_build_object(
      'id', q.id,
      'title', q.public_title,
      'introduction', q.introduction,
      'completion_message', q.completion_message,
      'version', q.version,
      'form_schema', q.form_schema
    )
  ) into public_payload
  from public.questionnaires q
  join public.businesses b on b.id = q.business_id
  where q.id = invitation_record.questionnaire_id
    and q.business_id = invitation_record.business_id
    and q.status = 'active';

  return public_payload;
end;
$$;

create function public.submit_questionnaire_response(
  raw_token text,
  response_answers jsonb,
  response_name text default null,
  response_email text default null,
  response_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  token_digest text;
  invitation_record public.questionnaire_invitations%rowtype;
  response_id uuid;
begin
  if jsonb_typeof(response_answers) <> 'object' then
    raise exception 'Questionnaire answers must be a JSON object';
  end if;

  if pg_column_size(response_answers) > 1048576 then
    raise exception 'Questionnaire answers exceed the 1 MB limit';
  end if;

  token_digest := encode(digest(raw_token, 'sha256'), 'hex');
  select i.* into invitation_record
  from public.questionnaire_invitations i
  where i.token_hash = token_digest
  for update;

  if not found
     or invitation_record.status in ('submitted', 'revoked', 'expired', 'delivery_failed')
     or invitation_record.expires_at <= now() then
    raise exception 'This questionnaire link is invalid, expired, or already used';
  end if;

  if not exists (
    select 1 from public.questionnaires q
    where q.id = invitation_record.questionnaire_id
      and q.business_id = invitation_record.business_id
      and q.status = 'active'
  ) then
    raise exception 'This questionnaire is not accepting responses';
  end if;

  insert into public.questionnaire_responses (
    business_id,
    questionnaire_id,
    invitation_id,
    client_id,
    respondent_name,
    respondent_email,
    respondent_phone,
    answers
  )
  values (
    invitation_record.business_id,
    invitation_record.questionnaire_id,
    invitation_record.id,
    invitation_record.client_id,
    nullif(btrim(response_name), ''),
    nullif(btrim(response_email), ''),
    nullif(btrim(response_phone), ''),
    response_answers
  )
  returning id into response_id;

  update public.questionnaire_invitations
  set status = 'submitted',
      submitted_at = now()
  where id = invitation_record.id;

  return response_id;
end;
$$;

create function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_payload jsonb;
  new_payload jsonb;
  row_payload jsonb;
  target_business_id uuid;
  target_entity_id uuid;
  safe_changes jsonb;
begin
  old_payload := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_payload := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_payload := coalesce(new_payload, old_payload);
  target_business_id := nullif(row_payload ->> 'business_id', '')::uuid;
  target_entity_id := coalesce(
    nullif(row_payload ->> 'id', '')::uuid,
    nullif(row_payload ->> 'job_id', '')::uuid
  );

  if tg_table_name = 'businesses' then
    target_business_id := target_entity_id;
  end if;

  if target_business_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  -- Parent-business deletion cascades should not be blocked by child audit rows.
  if not exists (select 1 from public.businesses b where b.id = target_business_id) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  old_payload := old_payload - array['token_hash', 'answers', 'delivery_error'];
  new_payload := new_payload - array['token_hash', 'answers', 'delivery_error'];

  safe_changes := case tg_op
    when 'INSERT' then jsonb_build_object('new', coalesce(new_payload, '{}'::jsonb))
    when 'UPDATE' then jsonb_build_object(
      'old', coalesce(old_payload, '{}'::jsonb),
      'new', coalesce(new_payload, '{}'::jsonb)
    )
    else jsonb_build_object('old', coalesce(old_payload, '{}'::jsonb))
  end;

  insert into public.audit_events (
    business_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    changes,
    request_id
  )
  values (
    target_business_id,
    auth.uid(),
    tg_table_name,
    target_entity_id,
    lower(tg_op),
    safe_changes,
    nullif(nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-request-id', '')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create function public.record_audit_event(
  target_business_id uuid,
  target_entity_type text,
  target_entity_id uuid,
  target_action text,
  event_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  event_id bigint;
begin
  if not public.is_business_member(target_business_id) then
    raise exception 'Not authorised to record an event for this business';
  end if;

  if jsonb_typeof(event_metadata) <> 'object' then
    raise exception 'Audit metadata must be a JSON object';
  end if;

  if char_length(btrim(target_entity_type)) = 0 or char_length(btrim(target_action)) = 0 then
    raise exception 'Audit entity type and action are required';
  end if;

  if pg_column_size(event_metadata) > 262144 then
    raise exception 'Audit metadata exceeds the 256 KB limit';
  end if;

  insert into public.audit_events (
    business_id,
    actor_user_id,
    entity_type,
    entity_id,
    action,
    changes
  )
  values (
    target_business_id,
    auth.uid(),
    target_entity_type,
    target_entity_id,
    target_action,
    event_metadata
  )
  returning id into event_id;

  return event_id;
end;
$$;

create trigger clients_audit
after insert or update or delete on public.clients
for each row execute function public.audit_row_change();
create trigger businesses_audit
after insert or update on public.businesses
for each row execute function public.audit_row_change();
create trigger profiles_audit
after update or delete on public.profiles
for each row execute function public.audit_row_change();
create trigger business_settings_audit
after update on public.business_settings
for each row execute function public.audit_row_change();
create trigger document_templates_audit
after insert or update or delete on public.document_templates
for each row execute function public.audit_row_change();
create trigger questionnaires_audit
after insert or update or delete on public.questionnaires
for each row execute function public.audit_row_change();
create trigger questionnaire_invitations_audit
after insert or update or delete on public.questionnaire_invitations
for each row execute function public.audit_row_change();
create trigger questionnaire_responses_audit
after update on public.questionnaire_responses
for each row execute function public.audit_row_change();
create trigger job_requests_audit
after insert or update or delete on public.job_requests
for each row execute function public.audit_row_change();
create trigger quotes_audit
after insert or update or delete on public.quotes
for each row execute function public.audit_row_change();
create trigger jobs_audit
after insert or update or delete on public.jobs
for each row execute function public.audit_row_change();
create trigger job_assignments_audit
after insert or update or delete on public.job_assignments
for each row execute function public.audit_row_change();
create trigger job_recurrences_audit
after insert or update or delete on public.job_recurrences
for each row execute function public.audit_row_change();
create trigger invoices_audit
after insert or update or delete on public.invoices
for each row execute function public.audit_row_change();
create trigger payments_audit
after insert or update or delete on public.payments
for each row execute function public.audit_row_change();

create trigger businesses_touch_updated_at
before update on public.businesses
for each row execute function public.touch_updated_at();
create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();
create trigger business_settings_touch_updated_at
before update on public.business_settings
for each row execute function public.touch_updated_at();
create trigger document_templates_touch_updated_at
before update on public.document_templates
for each row execute function public.touch_updated_at();
create trigger clients_touch_updated_at
before update on public.clients
for each row execute function public.touch_updated_at();
create trigger client_contacts_touch_updated_at
before update on public.client_contacts
for each row execute function public.touch_updated_at();
create trigger client_addresses_touch_updated_at
before update on public.client_addresses
for each row execute function public.touch_updated_at();
create trigger questionnaires_touch_updated_at
before update on public.questionnaires
for each row execute function public.touch_updated_at();
create trigger questionnaire_invitations_touch_updated_at
before update on public.questionnaire_invitations
for each row execute function public.touch_updated_at();
create trigger job_requests_touch_updated_at
before update on public.job_requests
for each row execute function public.touch_updated_at();
create trigger quotes_touch_updated_at
before update on public.quotes
for each row execute function public.touch_updated_at();
create trigger quote_line_items_touch_updated_at
before update on public.quote_line_items
for each row execute function public.touch_updated_at();
create trigger jobs_touch_updated_at
before update on public.jobs
for each row execute function public.touch_updated_at();
create trigger job_notes_touch_updated_at
before update on public.job_notes
for each row execute function public.touch_updated_at();
create trigger job_recurrences_touch_updated_at
before update on public.job_recurrences
for each row execute function public.touch_updated_at();
create trigger invoices_touch_updated_at
before update on public.invoices
for each row execute function public.touch_updated_at();
create trigger invoice_line_items_touch_updated_at
before update on public.invoice_line_items
for each row execute function public.touch_updated_at();
create trigger payments_touch_updated_at
before update on public.payments
for each row execute function public.touch_updated_at();

alter table public.businesses enable row level security;
alter table public.profiles enable row level security;
alter table public.business_settings enable row level security;
alter table public.document_templates enable row level security;
alter table public.document_sequences enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_addresses enable row level security;
alter table public.questionnaires enable row level security;
alter table public.questionnaire_invitations enable row level security;
alter table public.questionnaire_responses enable row level security;
alter table public.job_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.jobs enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_notes enable row level security;
alter table public.job_attachments enable row level security;
alter table public.job_recurrences enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_line_items enable row level security;
alter table public.payments enable row level security;
alter table public.audit_events enable row level security;

create policy businesses_select_members
on public.businesses for select to authenticated
using (owner_user_id = auth.uid() or public.is_business_member(id));

create policy businesses_insert_owner
on public.businesses for insert to authenticated
with check (owner_user_id = auth.uid());

create policy businesses_update_managers
on public.businesses for update to authenticated
using (public.can_manage_business(id))
with check (public.can_manage_business(id));

create policy businesses_delete_primary_owner
on public.businesses for delete to authenticated
using (owner_user_id = auth.uid());

create policy profiles_select_members
on public.profiles for select to authenticated
using (public.is_business_member(business_id));

create policy profiles_insert_managers
on public.profiles for insert to authenticated
with check (
  public.can_manage_business(business_id)
  or (
    id = auth.uid()
    and exists (
      select 1 from public.businesses b
      where b.id = business_id and b.owner_user_id = auth.uid()
    )
  )
);

create policy profiles_update_self_or_managers
on public.profiles for update to authenticated
using (id = auth.uid() or public.can_manage_business(business_id))
with check (id = auth.uid() or public.can_manage_business(business_id));

create policy profiles_delete_managers
on public.profiles for delete to authenticated
using (public.can_manage_business(business_id));

create policy business_settings_select_members
on public.business_settings for select to authenticated
using (public.is_business_member(business_id));

create policy business_settings_update_managers
on public.business_settings for update to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy document_templates_select_managers
on public.document_templates for select to authenticated
using (public.can_manage_business(business_id));

create policy document_templates_manage_managers
on public.document_templates for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy document_sequences_select_managers
on public.document_sequences for select to authenticated
using (public.can_manage_business(business_id));

create policy clients_select_members
on public.clients for select to authenticated
using (public.is_business_member(business_id));

create policy clients_manage_managers
on public.clients for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy client_contacts_select_members
on public.client_contacts for select to authenticated
using (public.is_business_member(business_id));

create policy client_contacts_manage_managers
on public.client_contacts for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy client_addresses_select_members
on public.client_addresses for select to authenticated
using (public.is_business_member(business_id));

create policy client_addresses_manage_managers
on public.client_addresses for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy questionnaires_manage_managers
on public.questionnaires for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy questionnaire_invitations_manage_managers
on public.questionnaire_invitations for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy questionnaire_responses_select_managers
on public.questionnaire_responses for select to authenticated
using (public.can_manage_business(business_id));

create policy questionnaire_responses_link_client_managers
on public.questionnaire_responses for update to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy job_requests_manage_managers
on public.job_requests for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy quotes_manage_managers
on public.quotes for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy quote_line_items_manage_managers
on public.quote_line_items for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy jobs_select_members
on public.jobs for select to authenticated
using (public.is_business_member(business_id));

create policy jobs_insert_managers
on public.jobs for insert to authenticated
with check (public.can_manage_business(business_id));

create policy jobs_update_managers_or_assigned_technicians
on public.jobs for update to authenticated
using (
  public.can_manage_business(business_id)
  or (
    public.current_business_role() = 'technician'
    and public.is_assigned_to_job(id, business_id)
  )
)
with check (
  public.can_manage_business(business_id)
  or (
    public.current_business_role() = 'technician'
    and public.is_assigned_to_job(id, business_id)
  )
);

create policy jobs_delete_managers
on public.jobs for delete to authenticated
using (public.can_manage_business(business_id));

create policy job_assignments_select_members
on public.job_assignments for select to authenticated
using (public.is_business_member(business_id));

create policy job_assignments_manage_managers
on public.job_assignments for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy job_notes_select_members
on public.job_notes for select to authenticated
using (public.is_business_member(business_id));

create policy job_notes_insert_managers_or_assignee
on public.job_notes for insert to authenticated
with check (
  created_by = auth.uid()
  and (
    public.can_manage_business(business_id)
    or public.is_assigned_to_job(job_id, business_id)
  )
);

create policy job_notes_update_managers_or_author_assignee
on public.job_notes for update to authenticated
using (
  public.can_manage_business(business_id)
  or (created_by = auth.uid() and public.is_assigned_to_job(job_id, business_id))
)
with check (
  public.can_manage_business(business_id)
  or (created_by = auth.uid() and public.is_assigned_to_job(job_id, business_id))
);

create policy job_notes_delete_managers_or_author_assignee
on public.job_notes for delete to authenticated
using (
  public.can_manage_business(business_id)
  or (created_by = auth.uid() and public.is_assigned_to_job(job_id, business_id))
);

create policy job_attachments_select_members
on public.job_attachments for select to authenticated
using (public.is_business_member(business_id));

create policy job_attachments_insert_managers_or_assignee
on public.job_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and (
    public.can_manage_business(business_id)
    or public.is_assigned_to_job(job_id, business_id)
  )
);

create policy job_attachments_delete_managers_or_uploader_assignee
on public.job_attachments for delete to authenticated
using (
  public.can_manage_business(business_id)
  or (uploaded_by = auth.uid() and public.is_assigned_to_job(job_id, business_id))
);

create policy job_recurrences_select_members
on public.job_recurrences for select to authenticated
using (public.is_business_member(business_id));

create policy job_recurrences_manage_managers
on public.job_recurrences for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy invoices_manage_managers
on public.invoices for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy invoice_line_items_manage_managers
on public.invoice_line_items for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy payments_manage_managers
on public.payments for all to authenticated
using (public.can_manage_business(business_id))
with check (public.can_manage_business(business_id));

create policy audit_events_select_managers
on public.audit_events for select to authenticated
using (public.can_manage_business(business_id));

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on table
  public.businesses,
  public.profiles,
  public.document_templates,
  public.clients,
  public.client_contacts,
  public.client_addresses,
  public.questionnaires,
  public.questionnaire_invitations,
  public.job_requests,
  public.quotes,
  public.quote_line_items,
  public.jobs,
  public.job_assignments,
  public.job_notes,
  public.job_attachments,
  public.job_recurrences,
  public.invoices,
  public.invoice_line_items,
  public.payments
to authenticated;

grant select, update on table public.business_settings to authenticated;
grant select, update on table public.questionnaire_responses to authenticated;
grant select on table public.document_sequences, public.audit_events to authenticated;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.provision_business_defaults() from public, anon, authenticated;
revoke all on function public.current_business_id() from public, anon, authenticated;
revoke all on function public.current_business_role() from public, anon, authenticated;
revoke all on function public.is_business_member(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_business(uuid) from public, anon, authenticated;
revoke all on function public.is_assigned_to_job(uuid, uuid) from public, anon, authenticated;
revoke all on function public.guard_profile_security_fields() from public, anon, authenticated;
revoke all on function public.guard_business_owner() from public, anon, authenticated;
revoke all on function public.assign_document_number() from public, anon, authenticated;
revoke all on function public.sync_quote_status_timestamps() from public, anon, authenticated;
revoke all on function public.sync_job_status_timestamps() from public, anon, authenticated;
revoke all on function public.sync_invoice_status_timestamps() from public, anon, authenticated;
revoke all on function public.guard_quote_derived_fields() from public, anon, authenticated;
revoke all on function public.guard_invoice_derived_fields() from public, anon, authenticated;
revoke all on function public.validate_document_template_kind() from public, anon, authenticated;
revoke all on function public.recalculate_quote_totals(uuid, uuid) from public, anon, authenticated;
revoke all on function public.recalculate_quote_after_line_change() from public, anon, authenticated;
revoke all on function public.recalculate_invoice_totals(uuid, uuid) from public, anon, authenticated;
revoke all on function public.recalculate_invoice_after_child_change() from public, anon, authenticated;
revoke all on function public.guard_questionnaire_response_update() from public, anon, authenticated;
revoke all on function public.guard_job_note_write() from public, anon, authenticated;
revoke all on function public.guard_technician_job_update() from public, anon, authenticated;
revoke all on function public.create_questionnaire_invitation(uuid, uuid, text, text, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.get_public_questionnaire(text) from public, anon, authenticated;
revoke all on function public.submit_questionnaire_response(text, jsonb, text, text, text)
  from public, anon, authenticated;
revoke all on function public.audit_row_change() from public, anon, authenticated;
revoke all on function public.record_audit_event(uuid, text, uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.current_business_id() to authenticated;
grant execute on function public.current_business_role() to authenticated;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.can_manage_business(uuid) to authenticated;
grant execute on function public.is_assigned_to_job(uuid, uuid) to authenticated;
grant execute on function public.create_questionnaire_invitation(uuid, uuid, text, text, uuid, timestamptz)
  to authenticated;
grant execute on function public.get_public_questionnaire(text) to anon, authenticated;
grant execute on function public.submit_questionnaire_response(text, jsonb, text, text, text)
  to anon, authenticated;
grant execute on function public.record_audit_event(uuid, text, uuid, text, jsonb)
  to authenticated;

comment on table public.profiles is
  'One active FieldCentral business membership per auth user. The primary owner is mirrored from businesses.owner_user_id.';
comment on table public.document_sequences is
  'Atomic per-business counters used by insert triggers; direct mutation is intentionally not granted to API roles.';
comment on table public.questionnaire_invitations is
  'Stores SHA-256 invitation token digests only. Raw bearer tokens must never be persisted or logged.';
comment on table public.invoices is
  'Document lifecycle and payment lifecycle are separate so sent/overdue/void never overload paid/partial/refunded.';
comment on table public.audit_events is
  'Append-only operational audit log. Direct API writes are disabled; use record_audit_event or audited table triggers.';
comment on function public.get_public_questionnaire(text) is
  'Public bearer-token RPC returning only questionnaire-safe presentation data; it never exposes the stored token digest.';
comment on function public.submit_questionnaire_response(text, jsonb, text, text, text) is
  'Single-use public bearer-token RPC that atomically records a response and consumes its invitation.';

commit;
