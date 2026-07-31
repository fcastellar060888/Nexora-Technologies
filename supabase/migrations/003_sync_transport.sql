create or replace function public.apply_sync_mutation(
  p_mutation_id uuid,
  p_organization_id uuid,
  p_device_id text,
  p_collection text,
  p_record_id text,
  p_operation text,
  p_base_version bigint,
  p_payload jsonb
)
returns table(status text, version bigint, conflict_id uuid, remote_version bigint, remote_payload jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_record public.erp_records%rowtype;
  v_conflict_id uuid;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if not exists (
    select 1 from public.memberships m
    where m.organization_id=p_organization_id and m.user_id=v_user_id and m.status='active'
  ) then raise exception 'organization access denied'; end if;
  if p_operation not in ('upsert','delete') then raise exception 'invalid operation'; end if;

  select * into v_record from public.erp_records
  where organization_id=p_organization_id and collection=p_collection and record_id=p_record_id
  for update;

  if found and v_record.version <> p_base_version then
    insert into public.sync_mutations(id,organization_id,user_id,device_id,collection,record_id,operation,base_version,payload,status,error,processed_at)
    values(p_mutation_id,p_organization_id,v_user_id,p_device_id,p_collection,p_record_id,p_operation,p_base_version,p_payload,'conflict','version mismatch',now())
    on conflict(id) do nothing;

    insert into public.sync_conflicts(organization_id,mutation_id,collection,record_id,local_payload,remote_payload,local_version,remote_version)
    values(p_organization_id,p_mutation_id,p_collection,p_record_id,p_payload,v_record.payload,p_base_version,v_record.version)
    returning id into v_conflict_id;

    return query select 'conflict'::text,v_record.version,v_conflict_id,v_record.version,v_record.payload;
    return;
  end if;

  insert into public.erp_records(organization_id,collection,record_id,payload,version,updated_by,updated_at,deleted_at)
  values(
    p_organization_id,p_collection,p_record_id,
    case when p_operation='delete' then coalesce(v_record.payload,p_payload) else p_payload end,
    coalesce(v_record.version,0)+1,v_user_id,now(),
    case when p_operation='delete' then now() else null end
  )
  on conflict(organization_id,collection,record_id) do update set
    payload=excluded.payload,
    version=public.erp_records.version+1,
    updated_by=v_user_id,
    updated_at=now(),
    deleted_at=excluded.deleted_at
  returning * into v_record;

  insert into public.sync_mutations(id,organization_id,user_id,device_id,collection,record_id,operation,base_version,payload,status,processed_at)
  values(p_mutation_id,p_organization_id,v_user_id,p_device_id,p_collection,p_record_id,p_operation,p_base_version,p_payload,'applied',now())
  on conflict(id) do update set status='applied',processed_at=now(),error=null;

  return query select 'applied'::text,v_record.version,null::uuid,null::bigint,null::jsonb;
end;
$$;

revoke all on function public.apply_sync_mutation(uuid,uuid,text,text,text,text,bigint,jsonb) from public;
grant execute on function public.apply_sync_mutation(uuid,uuid,text,text,text,text,bigint,jsonb) to authenticated;
