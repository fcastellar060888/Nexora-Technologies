create table if not exists public.mipe_treatment_executions (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  command_id text not null,
  signature text not null,
  treatment_id text not null,
  site_id text not null,
  result jsonb not null,
  executed_by uuid not null references auth.users(id),
  executed_at timestamptz not null default now(),
  primary key (organization_id, command_id)
);

alter table public.mipe_treatment_executions enable row level security;
revoke all on public.mipe_treatment_executions from public, anon, authenticated;

create or replace function public.commit_mipe_treatment_execution(
  p_command_id text,
  p_organization_id uuid,
  p_signature text,
  p_treatment_id text,
  p_site_id text,
  p_mutations jsonb
)
returns table(status text, records jsonb, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.mipe_treatment_executions%rowtype;
  v_existing_found boolean := false;
  v_mutation jsonb;
  v_record public.erp_records%rowtype;
  v_collection text;
  v_record_id text;
  v_operation text;
  v_payload jsonb;
  v_base_version bigint;
  v_next_version bigint;
  v_updated_at timestamptz;
  v_records jsonb := '[]'::jsonb;
  v_treatment jsonb;
  v_finding jsonb;
  v_lot jsonb;
  v_movement jsonb;
  v_cost jsonb;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if nullif(btrim(p_command_id),'') is null
    or nullif(btrim(p_signature),'') is null
    or nullif(btrim(p_treatment_id),'') is null
    or nullif(btrim(p_site_id),'') is null
  then raise exception 'incomplete MIPE treatment command'; end if;
  if p_mutations is null or jsonb_typeof(p_mutations) is distinct from 'array' or jsonb_array_length(p_mutations)<>5 then
    raise exception 'invalid MIPE treatment mutation set';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_organization_id::text),hashtext(p_command_id));

  select * into v_existing
  from public.mipe_treatment_executions
  where organization_id=p_organization_id and command_id=p_command_id
  for update;
  v_existing_found:=found;

  if not exists (
    select 1
    from public.memberships m
    join public.roles r on r.id=m.role_id
    where m.organization_id=p_organization_id
      and m.user_id=v_user_id
      and m.status='active'
      and not ('execute_treatments'=any(m.denied_permissions))
      and ('*'=any(r.permissions) or 'execute_treatments'=any(r.permissions) or 'execute_treatments'=any(m.permission_overrides))
      and (
        not exists (select 1 from public.membership_sites scope where scope.membership_id=m.id)
        or exists (select 1 from public.membership_sites scope where scope.membership_id=m.id and scope.site_id::text=p_site_id)
      )
  ) then raise exception 'MIPE treatment execution access denied'; end if;

  if v_existing_found then
    if v_existing.signature is distinct from p_signature
      or v_existing.treatment_id is distinct from p_treatment_id
      or v_existing.site_id is distinct from p_site_id
    then raise exception 'commandId already belongs to different MIPE treatment content'; end if;
    return query select 'applied'::text,v_existing.result,true;
    return;
  end if;

  if (select count(*) from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='inventoryLots')<>1
    or (select count(*) from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='inventoryMovements')<>1
    or (select count(*) from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='treatments' and mutation->>'recordId'=p_treatment_id)<>1
    or (select count(*) from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='findings')<>1
    or (select count(*) from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='costEntries')<>1
  then raise exception 'incomplete MIPE treatment transaction'; end if;

  if (
    select count(*)<>count(distinct jsonb_build_array(mutation->>'collection',mutation->>'recordId'))
    from jsonb_array_elements(p_mutations) mutation
  ) then raise exception 'duplicate MIPE treatment mutation identity'; end if;

  select mutation->'payload' into v_treatment from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='treatments' limit 1;
  select mutation->'payload' into v_finding from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='findings' limit 1;
  select mutation->'payload' into v_lot from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='inventoryLots' limit 1;
  select mutation->'payload' into v_movement from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='inventoryMovements' limit 1;
  select mutation->'payload' into v_cost from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='costEntries' limit 1;

  if v_treatment->>'id' is distinct from p_treatment_id or v_treatment->>'status' is distinct from 'Ejecutado' then
    raise exception 'invalid executed MIPE treatment';
  end if;
  if v_finding->>'id' is distinct from v_treatment->>'findingId' or v_finding->>'status' is distinct from 'Seguimiento' then
    raise exception 'invalid MIPE finding consequence';
  end if;
  if v_movement->>'type' is distinct from 'Consumo'
    or v_movement->>'sourceType' is distinct from 'MipeTreatment'
    or v_movement->>'sourceId' is distinct from p_treatment_id
    or v_movement->>'lotId' is distinct from v_lot->>'id'
    or v_treatment->>'lotId' is distinct from v_lot->>'id'
    or v_cost->>'inventoryLotId' is distinct from v_lot->>'id'
  then raise exception 'invalid MIPE treatment inventory consequence'; end if;
  if v_lot->>'productId' is distinct from v_treatment->>'productId'
    or v_movement->>'productId' is distinct from v_treatment->>'productId'
    or v_cost->>'productId' is distinct from v_treatment->>'productId'
  then raise exception 'MIPE treatment product mismatch'; end if;
  if v_cost->>'treatmentId' is distinct from p_treatment_id or v_cost->>'findingId' is distinct from v_finding->>'id' then
    raise exception 'MIPE treatment cost mismatch'; end if;
  if coalesce((v_treatment->>'totalQuantity')::numeric<=0,true)
    or (v_movement->>'quantity')::numeric is distinct from (v_treatment->>'totalQuantity')::numeric
    or (v_movement->>'signedQuantity')::numeric is distinct from (-1*(v_movement->>'quantity')::numeric)
    or (v_movement->>'balanceAfter')::numeric is distinct from ((v_movement->>'balanceBefore')::numeric+(v_movement->>'signedQuantity')::numeric)
    or coalesce((v_movement->>'balanceAfter')::numeric<0,true)
    or (v_lot->>'quantity')::numeric is distinct from (v_movement->>'balanceAfter')::numeric
    or (v_cost->>'quantity')::numeric is distinct from (v_treatment->>'totalQuantity')::numeric
    or coalesce((v_cost->>'amount')::numeric<0,true)
  then raise exception 'MIPE treatment quantity or balance mismatch'; end if;

  for v_mutation in
    select value
    from jsonb_array_elements(p_mutations)
    order by value->>'collection',value->>'recordId'
  loop
    v_collection:=nullif(btrim(v_mutation->>'collection'),'');
    v_record_id:=nullif(btrim(v_mutation->>'recordId'),'');
    v_operation:=v_mutation->>'operation';
    v_payload:=v_mutation->'payload';
    v_base_version:=coalesce((v_mutation->>'baseVersion')::bigint,0);

    if v_collection is null or v_record_id is null or v_operation<>'upsert' or jsonb_typeof(v_payload)<>'object' or v_payload->>'id' is distinct from v_record_id then
      raise exception 'invalid MIPE treatment mutation';
    end if;
    if v_collection not in ('inventoryLots','inventoryMovements','treatments','findings','costEntries') then
      raise exception 'collection is outside MIPE treatment transaction boundary';
    end if;
    if coalesce(nullif(v_payload->>'organizationId',''),nullif(v_payload->>'companyId',''),nullif(v_payload->>'_organizationId','')) is distinct from p_organization_id::text
      or (v_payload ? 'organizationId' and nullif(v_payload->>'organizationId','') is distinct from p_organization_id::text)
      or (v_payload ? 'companyId' and nullif(v_payload->>'companyId','') is distinct from p_organization_id::text)
      or (v_payload ? '_organizationId' and nullif(v_payload->>'_organizationId','') is distinct from p_organization_id::text)
    then raise exception 'MIPE treatment mutation organization mismatch'; end if;
    if nullif(v_payload->>'siteId','') is distinct from p_site_id then
      raise exception 'MIPE treatment mutation site mismatch';
    end if;
    if v_collection='inventoryLots' and coalesce((v_payload->>'quantity')::numeric<0,true) then
      raise exception 'MIPE inventory lot cannot become negative';
    end if;
    if v_collection='inventoryMovements' and (
      v_payload->>'type' is distinct from 'Consumo'
      or v_payload->>'sourceType' is distinct from 'MipeTreatment'
      or v_payload->>'sourceId' is distinct from p_treatment_id
      or coalesce((v_payload->>'quantity')::numeric<=0,true)
    ) then raise exception 'invalid MIPE inventory movement'; end if;
    if v_collection='treatments' and (v_record_id<>p_treatment_id or v_payload->>'status' is distinct from 'Ejecutado') then
      raise exception 'invalid executed MIPE treatment mutation';
    end if;
    if v_collection='findings' and v_payload->>'status' is distinct from 'Seguimiento' then
      raise exception 'invalid MIPE finding mutation';
    end if;
    if v_collection='costEntries' and (v_payload->>'treatmentId' is distinct from p_treatment_id or coalesce((v_payload->>'amount')::numeric<0,true)) then
      raise exception 'invalid MIPE treatment cost mutation';
    end if;
    if v_collection in ('inventoryMovements','costEntries') and v_base_version<>0 then
      raise exception 'new MIPE treatment consequence must start at version zero';
    end if;

    select * into v_record
    from public.erp_records
    where organization_id=p_organization_id and collection=v_collection and record_id=v_record_id
    for update;

    if found and (v_record.version<>v_base_version or v_collection in ('inventoryMovements','costEntries')) then
      raise exception 'MIPE_TREATMENT_VERSION_CONFLICT:%:%:%',v_collection,v_record_id,v_record.version using errcode='40001';
    end if;
    if not found and v_collection in ('inventoryLots','treatments','findings') then
      raise exception 'MIPE_TREATMENT_VERSION_CONFLICT:%:%:missing',v_collection,v_record_id using errcode='40001';
    end if;
    if not found and v_base_version<>0 then
      raise exception 'MIPE_TREATMENT_VERSION_CONFLICT:%:%:missing',v_collection,v_record_id using errcode='40001';
    end if;
  end loop;

  if exists (
    select 1
    from public.erp_records current_treatment
    where current_treatment.organization_id=p_organization_id
      and current_treatment.collection='treatments'
      and current_treatment.record_id=p_treatment_id
      and (
        current_treatment.deleted_at is not null
        or current_treatment.payload->>'status' is distinct from 'Programado'
        or (
          current_treatment.payload-array['status','siteId','lotId','executedAt','executedBy','cost','reentryUntil','harvestRestrictedUntil','executionNotes','organizationId','companyId','_organizationId','_syncVersion','_updatedAt']::text[]
        ) is distinct from (
          v_treatment-array['status','siteId','lotId','executedAt','executedBy','cost','reentryUntil','harvestRestrictedUntil','executionNotes','organizationId','companyId','_organizationId','_syncVersion','_updatedAt']::text[]
        )
      )
  ) then raise exception 'remote MIPE treatment is not scheduled or was altered'; end if;

  if exists (
    select 1
    from public.erp_records current_lot
    where current_lot.organization_id=p_organization_id
      and current_lot.collection='inventoryLots'
      and current_lot.record_id=v_lot->>'id'
      and (
        current_lot.deleted_at is not null
        or (current_lot.payload->>'quantity')::numeric<>(v_movement->>'balanceBefore')::numeric
        or current_lot.payload->>'productId' is distinct from v_lot->>'productId'
        or current_lot.payload->>'siteId' is distinct from p_site_id
        or (
          current_lot.payload-array['quantity','updatedAt','organizationId','companyId','_organizationId','_syncVersion','_updatedAt']::text[]
        ) is distinct from (
          v_lot-array['quantity','updatedAt','organizationId','companyId','_organizationId','_syncVersion','_updatedAt']::text[]
        )
      )
  ) then raise exception 'remote MIPE inventory lot balance mismatch'; end if;

  for v_mutation in
    select value
    from jsonb_array_elements(p_mutations)
    order by value->>'collection',value->>'recordId'
  loop
    v_collection:=v_mutation->>'collection';
    v_record_id:=v_mutation->>'recordId';
    v_payload:=v_mutation->'payload';
    v_base_version:=coalesce((v_mutation->>'baseVersion')::bigint,0);
    v_next_version:=v_base_version+1;
    v_updated_at:=clock_timestamp();
    v_payload:=v_payload||jsonb_build_object('_organizationId',p_organization_id::text,'_syncVersion',v_next_version,'_updatedAt',v_updated_at);

    insert into public.erp_records(organization_id,collection,record_id,payload,version,updated_by,updated_at,deleted_at)
    values(p_organization_id,v_collection,v_record_id,v_payload,v_next_version,v_user_id,v_updated_at,null)
    on conflict(organization_id,collection,record_id) do update set
      payload=excluded.payload,
      version=public.erp_records.version+1,
      updated_by=v_user_id,
      updated_at=v_updated_at,
      deleted_at=null
    returning * into v_record;

    v_records:=v_records||jsonb_build_array(jsonb_build_object(
      'companyId',v_record.organization_id::text,
      'collection',v_record.collection,
      'recordId',v_record.record_id,
      'payload',v_record.payload,
      'version',v_record.version,
      'updatedAt',v_record.updated_at,
      'deletedAt',v_record.deleted_at
    ));
  end loop;

  insert into public.mipe_treatment_executions(
    organization_id,command_id,signature,treatment_id,site_id,result,executed_by
  ) values (
    p_organization_id,p_command_id,p_signature,p_treatment_id,p_site_id,v_records,v_user_id
  );

  return query select 'applied'::text,v_records,false;
end;
$$;

revoke all on function public.commit_mipe_treatment_execution(text,uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.commit_mipe_treatment_execution(text,uuid,text,text,text,jsonb) to authenticated;
