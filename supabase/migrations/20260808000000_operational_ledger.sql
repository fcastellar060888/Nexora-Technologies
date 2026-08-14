create table if not exists public.operational_ledger_counters (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  next_sequence bigint not null default 1 check (next_sequence > 0)
);

create table if not exists public.operational_ledger_events (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  sequence bigint not null check (sequence > 0),
  event_id text not null,
  event jsonb not null,
  event_name text not null,
  aggregate_type text not null,
  aggregate_id text not null,
  site_id text,
  actor_id text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  recorded_by uuid not null references auth.users(id),
  primary key (organization_id, event_id),
  unique (organization_id, sequence)
);

create index if not exists operational_ledger_org_sequence_idx
  on public.operational_ledger_events (organization_id, sequence);
create index if not exists operational_ledger_org_occurred_idx
  on public.operational_ledger_events (organization_id, occurred_at, sequence);
create index if not exists operational_ledger_aggregate_idx
  on public.operational_ledger_events (organization_id, aggregate_type, aggregate_id, sequence);

alter table public.operational_ledger_counters enable row level security;
alter table public.operational_ledger_events enable row level security;

revoke all on public.operational_ledger_counters from anon, authenticated;
revoke all on public.operational_ledger_events from anon, authenticated;
grant select on public.operational_ledger_events to authenticated;

create policy "members read operational ledger" on public.operational_ledger_events
for select using (public.is_org_member(organization_id));

create or replace function public.prevent_operational_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'operational ledger entries are immutable';
end;
$$;

drop trigger if exists operational_ledger_immutable on public.operational_ledger_events;
create trigger operational_ledger_immutable
before update or delete on public.operational_ledger_events
for each row execute function public.prevent_operational_ledger_mutation();

create or replace function public.append_operational_ledger_event(
  p_organization_id uuid,
  p_event jsonb
)
returns table(sequence bigint, recorded_at timestamptz, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event_id text;
  v_event_name text;
  v_aggregate_type text;
  v_aggregate_id text;
  v_site_id text;
  v_actor_id text;
  v_occurred_at timestamptz;
  v_sequence bigint;
  v_recorded_at timestamptz;
  v_existing public.operational_ledger_events%rowtype;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not public.is_org_member(p_organization_id) then raise exception 'organization access denied'; end if;
  if p_event is null or jsonb_typeof(p_event) <> 'object' then raise exception 'invalid domain event'; end if;

  v_event_id := nullif(btrim(p_event ->> 'eventId'), '');
  v_event_name := nullif(btrim(p_event ->> 'name'), '');
  v_aggregate_type := nullif(btrim(p_event #>> '{aggregate,type}'), '');
  v_aggregate_id := nullif(btrim(p_event #>> '{aggregate,id}'), '');
  v_site_id := nullif(btrim(p_event #>> '{context,siteId}'), '');
  v_actor_id := nullif(btrim(p_event #>> '{context,actorId}'), '');

  if v_event_id is null or v_event_name is null or v_aggregate_type is null or v_aggregate_id is null or v_actor_id is null then
    raise exception 'incomplete domain event';
  end if;
  if nullif(btrim(p_event #>> '{context,organizationId}'), '') is distinct from p_organization_id::text then
    raise exception 'event organization mismatch';
  end if;

  begin
    v_occurred_at := (p_event ->> 'occurredAt')::timestamptz;
  exception when others then
    raise exception 'invalid event occurredAt';
  end;

  insert into public.operational_ledger_counters(organization_id, next_sequence)
  values(p_organization_id, 1)
  on conflict(organization_id) do nothing;

  select c.next_sequence into v_sequence
  from public.operational_ledger_counters c
  where c.organization_id = p_organization_id
  for update;

  select * into v_existing
  from public.operational_ledger_events e
  where e.organization_id = p_organization_id and e.event_id = v_event_id;

  if found then
    if v_existing.event is distinct from p_event then
      raise exception 'eventId already belongs to different content';
    end if;
    return query select v_existing.sequence, v_existing.recorded_at, true;
    return;
  end if;

  v_recorded_at := now();

  insert into public.operational_ledger_events(
    organization_id, sequence, event_id, event, event_name,
    aggregate_type, aggregate_id, site_id, actor_id, occurred_at,
    recorded_at, recorded_by
  ) values (
    p_organization_id, v_sequence, v_event_id, p_event, v_event_name,
    v_aggregate_type, v_aggregate_id, v_site_id, v_actor_id, v_occurred_at,
    v_recorded_at, v_user_id
  );

  update public.operational_ledger_counters
  set next_sequence = v_sequence + 1
  where organization_id = p_organization_id;

  return query select v_sequence, v_recorded_at, false;
end;
$$;

revoke all on function public.append_operational_ledger_event(uuid,jsonb) from public, anon;
grant execute on function public.append_operational_ledger_event(uuid,jsonb) to authenticated;
