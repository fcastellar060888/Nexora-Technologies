create table if not exists public.sync_device_health (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'success' check (status in ('success','error')),
  total_attempts bigint not null default 0,
  total_successes bigint not null default 0,
  total_failures bigint not null default 0,
  consecutive_failures integer not null default 0,
  last_error text,
  last_reason text,
  last_duration_ms integer not null default 0,
  last_pushed integer not null default 0,
  last_pulled integer not null default 0,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, device_id)
);

alter table public.sync_device_health enable row level security;

create policy "members read organization device health" on public.sync_device_health
for select using (exists (
  select 1 from public.memberships m
  where m.organization_id=sync_device_health.organization_id
    and m.user_id=auth.uid() and m.status='active'
));

create or replace function public.record_sync_device_health(
  p_organization_id uuid,
  p_device_id text,
  p_status text,
  p_reason text,
  p_duration_ms integer,
  p_pushed integer,
  p_pulled integer,
  p_error text
)
returns public.sync_device_health
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid:=auth.uid();
  v_result public.sync_device_health%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.memberships m where m.organization_id=p_organization_id and m.user_id=v_user_id and m.status='active') then
    raise exception 'organization access denied';
  end if;
  if p_status not in ('success','error') then raise exception 'invalid status'; end if;

  insert into public.sync_device_health(
    organization_id,device_id,user_id,status,total_attempts,total_successes,total_failures,
    consecutive_failures,last_error,last_reason,last_duration_ms,last_pushed,last_pulled,last_seen_at,updated_at
  ) values(
    p_organization_id,p_device_id,v_user_id,p_status,1,
    case when p_status='success' then 1 else 0 end,
    case when p_status='error' then 1 else 0 end,
    case when p_status='error' then 1 else 0 end,
    nullif(p_error,''),p_reason,greatest(0,p_duration_ms),greatest(0,p_pushed),greatest(0,p_pulled),now(),now()
  )
  on conflict(organization_id,device_id) do update set
    user_id=v_user_id,
    status=excluded.status,
    total_attempts=sync_device_health.total_attempts+1,
    total_successes=sync_device_health.total_successes+case when excluded.status='success' then 1 else 0 end,
    total_failures=sync_device_health.total_failures+case when excluded.status='error' then 1 else 0 end,
    consecutive_failures=case when excluded.status='success' then 0 else sync_device_health.consecutive_failures+1 end,
    last_error=excluded.last_error,
    last_reason=excluded.last_reason,
    last_duration_ms=excluded.last_duration_ms,
    last_pushed=excluded.last_pushed,
    last_pulled=excluded.last_pulled,
    last_seen_at=now(),updated_at=now()
  returning * into v_result;
  return v_result;
end;
$$;

revoke all on function public.record_sync_device_health(uuid,text,text,text,integer,integer,integer,text) from public;
grant execute on function public.record_sync_device_health(uuid,text,text,text,integer,integer,integer,text) to authenticated;
