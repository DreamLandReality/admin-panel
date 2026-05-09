-- Reset admin schema from the current Supabase database snapshot.
-- This migration is intended as the single fresh-install baseline.

create extension if not exists "pgcrypto";

create table public.templates (
  id uuid not null default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  category text not null check (category = any (array['luxury'::text, 'modern'::text, 'investment'::text, 'villa'::text, 'affordable'::text])),
  framework text not null default 'astro'::text,
  github_repo text not null,
  manifest jsonb not null,
  config jsonb not null,
  default_data jsonb,
  preview_url text,
  preview_image text,
  version text not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint templates_pkey primary key (id)
);

create table public.deployments (
  id uuid not null default gen_random_uuid(),
  project_name text not null,
  slug text not null unique,
  template_id uuid not null,
  template_version text not null,
  template_manifest jsonb not null,
  site_data jsonb not null,
  status text not null default 'draft'::text check (status = any (array['draft'::text, 'deploying'::text, 'building'::text, 'live'::text, 'failed'::text, 'archived'::text])),
  github_repo text,
  live_url text,
  custom_domain text,
  site_token text unique,
  screenshot_url text,
  status_log jsonb not null default '[]'::jsonb,
  has_unpublished_changes boolean not null default false,
  deployed_by uuid,
  deployed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  github_repo_url text,
  cloudflare_project_id text,
  cloudflare_project_name text,
  error_message text,
  build_logs text,
  stable_url text,
  constraint deployments_pkey primary key (id),
  constraint deployments_template_id_fkey foreign key (template_id) references public.templates(id),
  constraint deployments_deployed_by_fkey foreign key (deployed_by) references auth.users(id)
);

create table public.deployment_attempts (
  id uuid not null default gen_random_uuid(),
  deployment_id uuid not null,
  attempt_key text not null,
  phase text not null,
  status text not null default 'pending'::text check (status = any (array['pending'::text, 'running'::text, 'succeeded'::text, 'failed'::text, 'skipped'::text])),
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint deployment_attempts_pkey primary key (id),
  constraint deployment_attempts_deployment_id_fkey foreign key (deployment_id) references public.deployments(id)
);

create table public.drafts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  deployment_id uuid,
  template_id uuid,
  template_slug text not null,
  current_step integer not null default 1,
  raw_text text default ''::text,
  section_data jsonb default '{}'::jsonb,
  sections_registry jsonb default '{}'::jsonb,
  collection_data jsonb default '{}'::jsonb,
  project_name text,
  site_slug text,
  last_active_page text,
  screenshot_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint drafts_pkey primary key (id),
  constraint drafts_user_id_fkey foreign key (user_id) references auth.users(id),
  constraint drafts_deployment_id_fkey foreign key (deployment_id) references public.deployments(id),
  constraint drafts_template_id_fkey foreign key (template_id) references public.templates(id)
);

create table public.form_submissions (
  id uuid not null default gen_random_uuid(),
  deployment_id uuid not null,
  deployment_slug text not null,
  name text not null,
  email text not null,
  phone text,
  message text,
  source_url text not null,
  ip_address text,
  form_type text not null default 'contact'::text,
  source_metadata jsonb,
  call_status text not null default 'pending'::text check (call_status = any (array['pending'::text, 'scheduled'::text, 'calling'::text, 'completed'::text, 'no_answer'::text, 'failed'::text, 'cancelled'::text, 'skipped'::text])),
  call_scheduled_at timestamp with time zone,
  call_scheduled_for timestamp with time zone,
  call_completed_at timestamp with time zone,
  elevenlabs_conversation_id text,
  call_attempts integer not null default 0 check (call_attempts >= 0),
  call_property_context text,
  lead_status text not null default 'new'::text check (lead_status = any (array['new'::text, 'attended'::text, 'follow_up'::text, 'closed'::text])),
  attended_by text check (attended_by is null or (attended_by = any (array['automated'::text, 'manual'::text]))),
  attended_at timestamp with time zone,
  attended_user_id uuid,
  call_notes text,
  call_transcript_raw jsonb,
  call_transcript_text text,
  created_at timestamp with time zone not null default now(),
  constraint form_submissions_pkey primary key (id),
  constraint form_submissions_deployment_id_fkey foreign key (deployment_id) references public.deployments(id),
  constraint form_submissions_attended_user_id_fkey foreign key (attended_user_id) references auth.users(id)
);

create table public.voice_settings (
  id boolean not null default true check (id = true),
  voice_agent_enabled boolean not null default false,
  dev_mode_enabled boolean not null default false,
  updated_by uuid,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint voice_settings_pkey primary key (id),
  constraint voice_settings_updated_by_fkey foreign key (updated_by) references auth.users(id)
);

insert into public.voice_settings (id)
values (true)
on conflict (id) do nothing;

create index idx_templates_is_active
  on public.templates (is_active)
  where is_active = true;

create index idx_templates_category
  on public.templates (category);

create index idx_deployments_status
  on public.deployments (status);

create index idx_deployments_template_id
  on public.deployments (template_id);

create index idx_deployments_deployed_by
  on public.deployments (deployed_by);

create index idx_deployments_created_at
  on public.deployments (created_at desc);

create index idx_deployments_status_created
  on public.deployments (status, created_at desc);

create index idx_deployment_attempts_deployment_id
  on public.deployment_attempts (deployment_id);

create index idx_deployment_attempts_status
  on public.deployment_attempts (status);

create index idx_deployment_attempts_attempt_key
  on public.deployment_attempts (attempt_key);

create index idx_drafts_user
  on public.drafts (user_id, template_slug);

create index idx_drafts_deployment_id
  on public.drafts (deployment_id)
  where deployment_id is not null;

create index idx_submissions_deployment_id
  on public.form_submissions (deployment_id);

create index idx_submissions_deployment_created
  on public.form_submissions (deployment_id, created_at desc);

create index idx_submissions_ip_created
  on public.form_submissions (ip_address, created_at);

create index idx_submissions_created_at
  on public.form_submissions (created_at desc);

create index idx_submissions_form_type
  on public.form_submissions (form_type);

create index idx_submissions_call_status
  on public.form_submissions (call_status);

create index idx_form_submissions_conversation_id
  on public.form_submissions (elevenlabs_conversation_id)
  where elevenlabs_conversation_id is not null;

create index idx_form_submissions_lead_status
  on public.form_submissions (lead_status);

create index idx_form_submissions_attended_by
  on public.form_submissions (attended_by)
  where attended_by is not null;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_templates_updated_at
  before update on public.templates
  for each row execute function public.update_updated_at();

create trigger trg_deployments_updated_at
  before update on public.deployments
  for each row execute function public.update_updated_at();

create trigger trg_deployment_attempts_updated_at
  before update on public.deployment_attempts
  for each row execute function public.update_updated_at();

create trigger trg_drafts_updated_at
  before update on public.drafts
  for each row execute function public.update_updated_at();

create trigger trg_voice_settings_updated_at
  before update on public.voice_settings
  for each row execute function public.update_updated_at();

create or replace function public.generate_unique_slug(project_name text)
returns text
language plpgsql
as $$
declare
  base_slug text;
  candidate text;
  suffix int := 2;
  slug_exists boolean;
begin
  base_slug := lower(project_name);
  base_slug := regexp_replace(base_slug, '[^a-z0-9\-]', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);
  base_slug := left(base_slug, 50);
  base_slug := trim(both '-' from base_slug);

  if base_slug = '' or base_slug is null then
    base_slug := 'property-site';
  end if;

  candidate := base_slug;

  loop
    select exists (
      select 1 from public.deployments where slug = candidate
    ) into slug_exists;

    if not slug_exists then
      return candidate;
    end if;

    candidate := base_slug || '-' || suffix;
    suffix := suffix + 1;

    if suffix > 100 then
      raise exception 'Could not generate unique slug for: %', project_name;
    end if;
  end loop;
end;
$$;

create or replace function public.append_status_log(
  p_deployment_id uuid,
  p_status text,
  p_step text default null,
  p_message text default '',
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
as $$
declare
  new_entry jsonb;
begin
  new_entry := jsonb_build_object(
    'status', p_status,
    'step', p_step,
    'message', p_message,
    'at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'metadata', p_metadata
  );

  update public.deployments
  set
    status_log = status_log || jsonb_build_array(new_entry),
    status = p_status,
    updated_at = now()
  where id = p_deployment_id;
end;
$$;

create or replace function public.enforce_sales_form_submission_follow_up_update()
returns trigger
language plpgsql
as $$
declare
  request_role text;
  request_user_id uuid;
begin
  request_role := (select auth.jwt()) -> 'app_metadata' ->> 'user_role';

  if request_role is distinct from 'sales' then
    return new;
  end if;

  if
    new.id is distinct from old.id or
    new.deployment_id is distinct from old.deployment_id or
    new.deployment_slug is distinct from old.deployment_slug or
    new.name is distinct from old.name or
    new.email is distinct from old.email or
    new.phone is distinct from old.phone or
    new.message is distinct from old.message or
    new.source_url is distinct from old.source_url or
    new.ip_address is distinct from old.ip_address or
    new.form_type is distinct from old.form_type or
    new.source_metadata is distinct from old.source_metadata or
    new.call_status is distinct from old.call_status or
    new.call_scheduled_at is distinct from old.call_scheduled_at or
    new.call_scheduled_for is distinct from old.call_scheduled_for or
    new.call_completed_at is distinct from old.call_completed_at or
    new.elevenlabs_conversation_id is distinct from old.elevenlabs_conversation_id or
    new.call_attempts is distinct from old.call_attempts or
    new.call_property_context is distinct from old.call_property_context or
    new.call_transcript_raw is distinct from old.call_transcript_raw or
    new.call_transcript_text is distinct from old.call_transcript_text or
    new.created_at is distinct from old.created_at
  then
    raise exception 'Sales users may update only approved follow-up fields'
      using errcode = '42501';
  end if;

  request_user_id := (select auth.uid());

  if new.attended_by is distinct from 'manual' then
    raise exception 'Sales follow-up updates must set attended_by to manual'
      using errcode = '42501';
  end if;

  if new.attended_user_id is distinct from request_user_id then
    raise exception 'Sales follow-up updates must set attended_user_id to the current user'
      using errcode = '42501';
  end if;

  if new.attended_at is null then
    raise exception 'Sales follow-up updates must set attended_at'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger trg_sales_form_submission_follow_up_guard
  before update on public.form_submissions
  for each row execute function public.enforce_sales_form_submission_follow_up_update();

alter table public.templates enable row level security;
alter table public.deployments enable row level security;
alter table public.deployment_attempts enable row level security;
alter table public.drafts enable row level security;
alter table public.form_submissions enable row level security;
alter table public.voice_settings enable row level security;

create policy "Admins can manage templates"
  on public.templates
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin');

create policy "Admins can manage deployments"
  on public.deployments
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin');

create policy "Admins can manage deployment attempts"
  on public.deployment_attempts
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin');

create policy "Admins can manage drafts"
  on public.drafts
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin');

create policy "Admins can manage form submissions"
  on public.form_submissions
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin');

create policy "Admins can manage voice settings"
  on public.voice_settings
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'admin');

create policy "Sales can read live deployments"
  on public.deployments
  for select to authenticated
  using (
    ((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'sales'
    and status = 'live'
  );

create policy "Sales can read form submissions"
  on public.form_submissions
  for select to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'sales');

create policy "Sales can update form submission follow up"
  on public.form_submissions
  for update to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'sales')
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'user_role') = 'sales');
