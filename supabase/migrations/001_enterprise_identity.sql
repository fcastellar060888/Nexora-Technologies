create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text,
  base_currency text not null default 'COP',
  status text not null default 'active' check (status in ('active','suspended','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_tax_id_unique
  on public.organizations (lower(tax_id)) where tax_id is not null and tax_id <> '';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  phone text,
  status text not null default 'active' check (status in ('active','inactive','locked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id),
  status text not null default 'active' check (status in ('invited','active','suspended','revoked')),
  permission_overrides text[] not null default '{}',
  denied_permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.membership_sites (
  membership_id uuid not null references public.memberships(id) on delete cascade,
  site_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (membership_id, site_id)
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  device_name text,
  ip_address inet,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_sites enable row level security;
alter table public.user_sessions enable row level security;

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id=target_org
      and m.user_id=auth.uid()
      and m.status='active'
  );
$$;

create policy organizations_member_read on public.organizations
for select using (public.is_org_member(id));

create policy profiles_self_read on public.profiles
for select using (id=auth.uid());

create policy memberships_self_read on public.memberships
for select using (user_id=auth.uid());

create policy roles_member_read on public.roles
for select using (organization_id is null or public.is_org_member(organization_id));

create policy membership_sites_member_read on public.membership_sites
for select using (
  exists(select 1 from public.memberships m where m.id=membership_id and m.user_id=auth.uid() and m.status='active')
);

create policy sessions_self_manage on public.user_sessions
for all using (user_id=auth.uid()) with check (user_id=auth.uid());
