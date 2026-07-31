create table if not exists public.erp_records (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  collection text not null,
  record_id text not null,
  payload jsonb,
  version bigint not null default 1,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (organization_id, collection, record_id)
);

create index if not exists erp_records_org_updated_idx
  on public.erp_records (organization_id, updated_at);
create index if not exists erp_records_collection_idx
  on public.erp_records (organization_id, collection, updated_at);

create table if not exists public.sync_mutations (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  collection text not null,
  record_id text not null,
  operation text not null check (operation in ('upsert','delete')),
  base_version bigint not null default 0,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending','applied','conflict','failed')),
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists sync_mutations_org_created_idx
  on public.sync_mutations (organization_id, created_at);

create table if not exists public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mutation_id uuid references public.sync_mutations(id) on delete set null,
  collection text not null,
  record_id text not null,
  local_payload jsonb,
  remote_payload jsonb,
  local_version bigint not null default 0,
  remote_version bigint not null default 0,
  status text not null default 'open' check (status in ('open','resolved')),
  resolution text check (resolution in ('local','remote','merged')),
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.erp_records enable row level security;
alter table public.sync_mutations enable row level security;
alter table public.sync_conflicts enable row level security;

create policy "members read organization records" on public.erp_records
for select using (exists (
  select 1 from public.memberships m
  where m.organization_id=erp_records.organization_id
    and m.user_id=auth.uid() and m.status='active'
));

create policy "members write organization records" on public.erp_records
for all using (exists (
  select 1 from public.memberships m
  where m.organization_id=erp_records.organization_id
    and m.user_id=auth.uid() and m.status='active'
)) with check (exists (
  select 1 from public.memberships m
  where m.organization_id=erp_records.organization_id
    and m.user_id=auth.uid() and m.status='active'
));

create policy "users manage own mutations" on public.sync_mutations
for all using (user_id=auth.uid()) with check (user_id=auth.uid());

create policy "members read organization conflicts" on public.sync_conflicts
for select using (exists (
  select 1 from public.memberships m
  where m.organization_id=sync_conflicts.organization_id
    and m.user_id=auth.uid() and m.status='active'
));
