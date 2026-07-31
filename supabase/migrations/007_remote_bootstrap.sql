begin;

create or replace function public.load_organization_state(p_organization_id uuid)
returns table(
  organization_id uuid,
  collection text,
  record_id text,
  payload jsonb,
  version bigint,
  updated_at timestamptz,
  deleted_at timestamptz
)
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not exists(
    select 1
    from public.memberships m
    where m.organization_id=p_organization_id
      and m.user_id=auth.uid()
      and m.status='active'
  ) then
    raise exception 'Active organization membership required';
  end if;

  return query
  select r.organization_id,r.collection,r.record_id,r.payload,r.version,r.updated_at,r.deleted_at
  from public.erp_records r
  where r.organization_id=p_organization_id
  order by r.collection,r.record_id;
end;
$$;

revoke all on function public.load_organization_state(uuid) from public;
grant execute on function public.load_organization_state(uuid) to authenticated;

commit;
