-- V18: Assessment Templates
-- Stores reusable assessment configuration presets per org.

create table if not exists assessment_templates (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  config jsonb not null default '{}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_assessment_templates_org on assessment_templates(org_id);

-- RLS
alter table assessment_templates enable row level security;

create policy "Org members can view templates"
  on assessment_templates for select
  using (
    exists (
      select 1 from organization_members
      where organization_members.org_id = assessment_templates.org_id
        and organization_members.user_id = auth.uid()
    )
  );

create policy "Creators can insert templates"
  on assessment_templates for insert
  with check (
    exists (
      select 1 from organization_members
      where organization_members.org_id = assessment_templates.org_id
        and organization_members.user_id = auth.uid()
        and organization_members.role in ('creator', 'admin', 'owner')
    )
  );

create policy "Creators can delete own templates"
  on assessment_templates for delete
  using (
    assessment_templates.created_by = auth.uid()
    or exists (
      select 1 from organization_members
      where organization_members.org_id = assessment_templates.org_id
        and organization_members.user_id = auth.uid()
        and organization_members.role in ('admin', 'owner')
    )
  );
