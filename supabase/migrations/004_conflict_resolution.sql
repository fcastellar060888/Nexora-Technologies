create or replace function public.resolve_sync_conflict(
  p_conflict_id uuid,
  p_resolution text,
  p_payload jsonb default null
)
returns table(status text, version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conflict public.sync_conflicts%rowtype;
  v_record public.erp_records%rowtype;
  v_payload jsonb;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if p_resolution not in ('local','remote','merged') then raise exception 'invalid resolution'; end if;

  select * into v_conflict from public.sync_conflicts
  where id=p_conflict_id and status='open'
  for update;
  if not found then raise exception 'open conflict not found'; end if;

  if not exists (
    select 1 from public.memberships m
    join public.roles r on r.id=m.role_id
    where m.organization_id=v_conflict.organization_id
      and m.user_id=v_user_id and m.status='active'
      and ('manage_settings'=any(r.permissions) or 'manage_organization'=any(r.permissions))
  ) then raise exception 'conflict resolution access denied'; end if;

  select * into v_record from public.erp_records
  where organization_id=v_conflict.organization_id
    and collection=v_conflict.collection and record_id=v_conflict.record_id
  for update;

  if p_resolution='local' then v_payload:=v_conflict.local_payload;
  elsif p_resolution='merged' then
    if p_payload is null then raise exception 'merged payload required'; end if;
    v_payload:=p_payload;
  else v_payload:=v_conflict.remote_payload;
  end if;

  if p_resolution in ('local','merged') then
    update public.erp_records set
      payload=v_payload,
      version=version+1,
      updated_by=v_user_id,
      updated_at=now(),
      deleted_at=null
    where organization_id=v_conflict.organization_id
      and collection=v_conflict.collection and record_id=v_conflict.record_id
    returning * into v_record;
  end if;

  update public.sync_conflicts set
    status='resolved',resolution=p_resolution,resolved_by=v_user_id,
    resolved_at=now(),local_payload=case when p_resolution='merged' then v_payload else local_payload end
  where id=p_conflict_id;

  update public.sync_mutations set
    status='applied',error=null,processed_at=now()
  where id=v_conflict.mutation_id;

  return query select 'resolved'::text,coalesce(v_record.version,v_conflict.remote_version);
end;
$$;

revoke all on function public.resolve_sync_conflict(uuid,text,jsonb) from public;
grant execute on function public.resolve_sync_conflict(uuid,text,jsonb) to authenticated;
