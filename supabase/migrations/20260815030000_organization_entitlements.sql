create table if not exists public.organization_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capability text not null,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  starts_at timestamptz,
  ends_at timestamptz,
  source text not null default 'contract',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, capability),
  check (capability <> ''),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists organization_entitlements_org_idx
  on public.organization_entitlements(organization_id, status, capability);

alter table public.organization_entitlements enable row level security;

create policy organization_entitlements_member_read
on public.organization_entitlements
for select to authenticated
using (public.is_org_member(organization_id));

-- Provisioning intentionally has no authenticated INSERT/UPDATE/DELETE policy.
-- Entitlements are commercial/product governance, not an IAM permission editable by app users.
