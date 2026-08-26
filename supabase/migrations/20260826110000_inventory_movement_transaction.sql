create table if not exists public.inventory_movement_executions (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  command_id text not null,
  signature text not null,
  lot_id text not null,
  movement_id text not null,
  result jsonb not null,
  executed_by uuid not null references auth.users(id),
  executed_at timestamptz not null default now(),
  primary key (organization_id, command_id)
);

alter table public.inventory_movement_executions enable row level security;
revoke all on public.inventory_movement_executions from public, anon, authenticated;

create or replace function public.commit_inventory_movement(
  p_command_id text,
  p_organization_id uuid,
  p_signature text,
  p_lot_id text,
  p_movement_id text,
  p_mutations jsonb
)
returns table(status text, records jsonb, duplicate boolean)
language plpgsql
security definer
set search_path=public
as $$
declare
  v_user_id uuid:=auth.uid();
  v_existing public.inventory_movement_executions%rowtype;
  v_lot public.erp_records%rowtype;
  v_record public.erp_records%rowtype;
  v_mutation jsonb;
  v_payload jsonb;
  v_collection text;
  v_record_id text;
  v_base_version bigint;
  v_next_version bigint;
  v_updated_at timestamptz;
  v_records jsonb:='[]'::jsonb;
  v_site_id text;
  v_first jsonb;
  v_last jsonb;
  v_remote_head_id text;
  v_remote_head_sequence bigint:=0;
  v_remote_head_balance numeric;
  v_bootstrap_count integer:=0;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if nullif(btrim(p_command_id),'') is null or nullif(btrim(p_signature),'') is null or nullif(btrim(p_lot_id),'') is null or nullif(btrim(p_movement_id),'') is null then
    raise exception 'incomplete inventory movement command';
  end if;
  if p_mutations is null or jsonb_typeof(p_mutations) is distinct from 'array' or jsonb_array_length(p_mutations) not between 2 and 3 then
    raise exception 'invalid inventory movement mutation set';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_organization_id::text),hashtext(p_lot_id));

  select * into v_existing from public.inventory_movement_executions
  where organization_id=p_organization_id and command_id=p_command_id for update;
  if found then
    if v_existing.signature is distinct from p_signature or v_existing.lot_id is distinct from p_lot_id or v_existing.movement_id is distinct from p_movement_id then
      raise exception 'commandId already belongs to different inventory movement content';
    end if;
    return query select 'applied'::text,v_existing.result,true;
    return;
  end if;

  if (select count(*) from jsonb_array_elements(p_mutations) m where m->>'collection'='inventoryLots' and m->>'recordId'=p_lot_id)<>1
    or (select count(*) from jsonb_array_elements(p_mutations) m where m->>'collection'='inventoryMovements') not between 1 and 2
    or not exists(select 1 from jsonb_array_elements(p_mutations) m where m->>'collection'='inventoryMovements' and m->>'recordId'=p_movement_id)
  then raise exception 'inventory movement transaction boundary mismatch'; end if;

  select * into v_lot from public.erp_records
  where organization_id=p_organization_id and collection='inventoryLots' and record_id=p_lot_id for update;
  if not found or v_lot.deleted_at is not null then
    raise exception 'INVENTORY_MOVEMENT_VERSION_CONFLICT:inventoryLots:%:missing',p_lot_id using errcode='40001';
  end if;
  v_site_id:=nullif(v_lot.payload->>'siteId','');
  if v_site_id is null then raise exception 'inventory lot site is required'; end if;

  if not exists(
    select 1 from public.memberships m join public.roles r on r.id=m.role_id
    where m.organization_id=p_organization_id and m.user_id=v_user_id and m.status='active'
      and not ('manage_inventory'=any(m.denied_permissions))
      and ('*'=any(r.permissions) or 'manage_inventory'=any(r.permissions) or 'manage_inventory'=any(m.permission_overrides))
      and (
        not exists(select 1 from public.membership_sites scope where scope.membership_id=m.id)
        or exists(select 1 from public.membership_sites scope where scope.membership_id=m.id and scope.site_id::text=v_site_id)
      )
  ) then raise exception 'inventory movement access denied'; end if;

  if (select count(*)<>count(distinct jsonb_build_array(m->>'collection',m->>'recordId')) from jsonb_array_elements(p_mutations) m) then
    raise exception 'duplicate inventory movement mutation identity';
  end if;

  for v_mutation in select value from jsonb_array_elements(p_mutations) loop
    v_collection:=nullif(btrim(v_mutation->>'collection'),'');
    v_record_id:=nullif(btrim(v_mutation->>'recordId'),'');
    v_payload:=v_mutation->'payload';
    v_base_version:=coalesce((v_mutation->>'baseVersion')::bigint,0);
    if v_mutation->>'operation'<>'upsert' or v_collection not in('inventoryLots','inventoryMovements') or v_record_id is null or jsonb_typeof(v_payload)<>'object' or v_payload->>'id' is distinct from v_record_id then
      raise exception 'invalid inventory movement mutation';
    end if;
    if coalesce(nullif(v_payload->>'organizationId',''),nullif(v_payload->>'companyId',''),nullif(v_payload->>'_organizationId','')) is distinct from p_organization_id::text
      or (v_payload?'organizationId' and nullif(v_payload->>'organizationId','') is distinct from p_organization_id::text)
      or (v_payload?'companyId' and nullif(v_payload->>'companyId','') is distinct from p_organization_id::text)
      or (v_payload?'_organizationId' and nullif(v_payload->>'_organizationId','') is distinct from p_organization_id::text)
    then raise exception 'inventory movement organization mismatch'; end if;
    if nullif(v_payload->>'siteId','') is distinct from v_site_id then raise exception 'inventory movement site mismatch'; end if;
    if v_collection='inventoryLots' then
      if v_record_id<>p_lot_id or v_base_version<>v_lot.version or coalesce((v_payload->>'quantity')::numeric<0,true) then
        raise exception 'INVENTORY_MOVEMENT_VERSION_CONFLICT:inventoryLots:%:%',p_lot_id,v_lot.version using errcode='40001';
      end if;
      if v_payload->>'productId' is distinct from v_lot.payload->>'productId' or v_payload->>'siteId' is distinct from v_lot.payload->>'siteId' then
        raise exception 'inventory lot identity changed during movement';
      end if;
    else
      if v_base_version<>0 then raise exception 'new inventory movement must start at version zero'; end if;
      if exists(select 1 from public.erp_records r where r.organization_id=p_organization_id and r.collection='inventoryMovements' and r.record_id=v_record_id) then
        raise exception 'INVENTORY_MOVEMENT_VERSION_CONFLICT:inventoryMovements:%:exists',v_record_id using errcode='40001';
      end if;
      if v_payload->>'lotId' is distinct from p_lot_id or v_payload->>'productId' is distinct from v_lot.payload->>'productId' then raise exception 'inventory movement lot/product mismatch'; end if;
      if coalesce((v_payload->>'quantity')::numeric<=0,true) or (v_payload->>'balanceAfter')::numeric is distinct from ((v_payload->>'balanceBefore')::numeric+(v_payload->>'signedQuantity')::numeric) or coalesce((v_payload->>'balanceAfter')::numeric<0,true) then
        raise exception 'invalid inventory movement arithmetic';
      end if;
      if v_payload->>'sourceType'='LegacyInventoryBootstrap' then v_bootstrap_count:=v_bootstrap_count+1;
      elsif v_payload->>'sourceType' is distinct from 'Manual' then raise exception 'unauthorized inventory movement source';
      end if;
    end if;
  end loop;
  if v_bootstrap_count>1 then raise exception 'multiple legacy bootstrap movements are forbidden'; end if;

  select m->'payload' into v_first from jsonb_array_elements(p_mutations) m
  where m->>'collection'='inventoryMovements' order by (m->'payload'->>'ledgerSequence')::bigint asc limit 1;
  select m->'payload' into v_last from jsonb_array_elements(p_mutations) m
  where m->>'collection'='inventoryMovements' order by (m->'payload'->>'ledgerSequence')::bigint desc limit 1;

  select r.record_id,(r.payload->>'ledgerSequence')::bigint,(r.payload->>'balanceAfter')::numeric
    into v_remote_head_id,v_remote_head_sequence,v_remote_head_balance
  from public.erp_records r
  where r.organization_id=p_organization_id and r.collection='inventoryMovements' and r.deleted_at is null and r.payload->>'lotId'=p_lot_id
  order by (r.payload->>'ledgerSequence')::bigint desc,r.record_id desc limit 1;

  if v_bootstrap_count=1 then
    if v_remote_head_id is not null
      or v_first->>'id' is distinct from ('inventory-opening:'||p_organization_id::text||':'||p_lot_id)
      or (v_first->>'ledgerSequence')::bigint<>1 or nullif(v_first->>'previousMovementId','') is not null
      or (v_first->>'balanceBefore')::numeric<>0 or (v_first->>'balanceAfter')::numeric<>(v_lot.payload->>'quantity')::numeric
    then raise exception 'INVENTORY_MOVEMENT_LEDGER_CONFLICT:%:legacy',p_lot_id using errcode='40001'; end if;

    -- A legacy transaction carries exactly bootstrap + manual movement. Verify the
    -- causal edge server-side; final-balance equality alone cannot prove continuity.
    if (select count(*) from jsonb_array_elements(p_mutations) m where m->>'collection'='inventoryMovements')<>2
      or v_last->>'id' is not distinct from v_first->>'id'
      or v_last->>'sourceType' is distinct from 'Manual'
      or (v_last->>'previousMovementId') is distinct from (v_first->>'id')
      or (v_last->>'ledgerSequence')::bigint<>(v_first->>'ledgerSequence')::bigint+1
      or (v_last->>'balanceBefore')::numeric<>(v_first->>'balanceAfter')::numeric
    then raise exception 'INVENTORY_MOVEMENT_LEDGER_CONFLICT:%:legacy-chain',p_lot_id using errcode='40001'; end if;
  else
    if v_remote_head_id is null then
      if (v_lot.payload->>'quantity')::numeric<>0 or (v_first->>'ledgerSequence')::bigint<>1 or nullif(v_first->>'previousMovementId','') is not null or (v_first->>'balanceBefore')::numeric<>0 then
        raise exception 'INVENTORY_MOVEMENT_LEDGER_CONFLICT:%:empty',p_lot_id using errcode='40001'; end if;
    elsif (v_first->>'previousMovementId') is distinct from v_remote_head_id
      or (v_first->>'ledgerSequence')::bigint<>v_remote_head_sequence+1
      or (v_first->>'balanceBefore')::numeric<>v_remote_head_balance
      or v_remote_head_balance<>(v_lot.payload->>'quantity')::numeric
    then raise exception 'INVENTORY_MOVEMENT_LEDGER_CONFLICT:%:head',p_lot_id using errcode='40001'; end if;
  end if;

  if (v_last->>'balanceAfter')::numeric<>(select (m->'payload'->>'quantity')::numeric from jsonb_array_elements(p_mutations) m where m->>'collection'='inventoryLots' limit 1) then
    raise exception 'inventory lot final balance does not match movement chain';
  end if;

  for v_mutation in select value from jsonb_array_elements(p_mutations) order by case when value->>'collection'='inventoryMovements' then 1 else 2 end,(value->'payload'->>'ledgerSequence')::bigint nulls last loop
    v_collection:=v_mutation->>'collection';v_record_id:=v_mutation->>'recordId';v_payload:=v_mutation->'payload';v_base_version:=coalesce((v_mutation->>'baseVersion')::bigint,0);v_next_version:=v_base_version+1;v_updated_at:=clock_timestamp();
    v_payload:=v_payload||jsonb_build_object('_organizationId',p_organization_id::text,'_syncVersion',v_next_version,'_updatedAt',v_updated_at);
    insert into public.erp_records(organization_id,collection,record_id,payload,version,updated_by,updated_at,deleted_at)
    values(p_organization_id,v_collection,v_record_id,v_payload,v_next_version,v_user_id,v_updated_at,null)
    on conflict(organization_id,collection,record_id) do update set payload=excluded.payload,version=public.erp_records.version+1,updated_by=v_user_id,updated_at=v_updated_at,deleted_at=null
    returning * into v_record;
    v_records:=v_records||jsonb_build_array(jsonb_build_object('companyId',v_record.organization_id::text,'collection',v_record.collection,'recordId',v_record.record_id,'payload',v_record.payload,'version',v_record.version,'updatedAt',v_record.updated_at,'deleted',v_record.deleted_at is not null));
  end loop;

  insert into public.inventory_movement_executions(organization_id,command_id,signature,lot_id,movement_id,result,executed_by)
  values(p_organization_id,p_command_id,p_signature,p_lot_id,p_movement_id,v_records,v_user_id);
  return query select 'applied'::text,v_records,false;
end;
$$;

revoke all on function public.commit_inventory_movement(text,uuid,text,text,text,jsonb) from public, anon;
grant execute on function public.commit_inventory_movement(text,uuid,text,text,text,jsonb) to authenticated;
