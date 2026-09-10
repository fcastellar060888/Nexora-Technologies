create table if not exists public.mirfe_inventory_executions (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  command_id text not null,
  signature text not null,
  preparation_id text not null,
  site_id text not null,
  result jsonb not null,
  executed_by uuid not null references auth.users(id),
  executed_at timestamptz not null default now(),
  primary key (organization_id, command_id)
);

alter table public.mirfe_inventory_executions enable row level security;
revoke all on public.mirfe_inventory_executions from public, anon, authenticated;

create or replace function public.commit_mirfe_inventory_execution(
  p_command_id text,
  p_organization_id uuid,
  p_signature text,
  p_preparation_id text,
  p_mutations jsonb
)
returns table(status text, records jsonb, duplicate boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing public.mirfe_inventory_executions%rowtype;
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
  v_site_id text;
  v_existing_found boolean := false;
begin
  if v_user_id is null then raise exception 'authentication required'; end if;
  if nullif(btrim(p_command_id),'') is null or nullif(btrim(p_signature),'') is null or nullif(btrim(p_preparation_id),'') is null then
    raise exception 'incomplete MIRFE inventory command';
  end if;
  if p_mutations is null or jsonb_typeof(p_mutations) is distinct from 'array' then
    raise exception 'invalid MIRFE inventory mutation set';
  end if;
  if jsonb_array_length(p_mutations) < 4 or jsonb_array_length(p_mutations) > 100 then
    raise exception 'invalid MIRFE inventory mutation set';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_organization_id::text),hashtext(p_command_id));

  select * into v_existing
  from public.mirfe_inventory_executions
  where organization_id=p_organization_id and command_id=p_command_id
  for update;
  v_existing_found:=found;

  if v_existing_found then
    v_site_id:=v_existing.site_id;
  else
    select mutation->'payload'->>'siteId' into v_site_id
    from jsonb_array_elements(p_mutations) mutation
    where mutation->>'collection'='tankPreparations' and mutation->>'recordId'=p_preparation_id
    limit 1;
  end if;

  if nullif(btrim(v_site_id),'') is null then raise exception 'MIRFE preparation site is required'; end if;

  if not exists (
    select 1
    from public.memberships m
    join public.roles r on r.id=m.role_id
    where m.organization_id=p_organization_id
      and m.user_id=v_user_id
      and m.status='active'
      and not ('manage_irrigation'=any(m.denied_permissions))
      and ('*'=any(r.permissions) or 'manage_irrigation'=any(r.permissions) or 'manage_irrigation'=any(m.permission_overrides))
      and (
        not exists (select 1 from public.membership_sites scope where scope.membership_id=m.id)
        or exists (select 1 from public.membership_sites scope where scope.membership_id=m.id and scope.site_id::text=v_site_id)
      )
  ) then raise exception 'MIRFE inventory execution access denied'; end if;

  if v_existing_found then
    if v_existing.signature is distinct from p_signature or v_existing.preparation_id is distinct from p_preparation_id then
      raise exception 'commandId already belongs to different MIRFE inventory content';
    end if;
    return query select 'applied'::text,v_existing.result,true;
    return;
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_mutations) mutation
    where mutation->>'collection'='tankPreparations'
      and mutation->>'recordId'=p_preparation_id
      and mutation->'payload'->>'status'='Preparada'
  ) <> 1 then raise exception 'exactly one prepared MIRFE preparation is required'; end if;

  if (
    select count(*)
    from jsonb_array_elements(p_mutations) mutation,
         jsonb_array_elements(coalesce(mutation->'payload'->'commandReceipts','[]'::jsonb)) receipt
    where mutation->>'collection'='tankPreparations'
      and mutation->>'recordId'=p_preparation_id
      and receipt->>'commandId'=p_command_id
      and receipt->>'signature'=p_signature
  ) <> 1 then raise exception 'MIRFE command receipt mismatch'; end if;

  if (select count(*) from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='inventoryLots') < 1
    or (select count(*) from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='inventoryMovements') < 1
    or (select count(*) from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='workOrders') <> 1
    or (select count(*) from jsonb_array_elements(p_mutations) mutation where mutation->>'collection'='costEntries') > 1
  then raise exception 'incomplete MIRFE inventory transaction'; end if;

  if exists (
    select 1 from jsonb_array_elements(p_mutations) mutation
    where mutation->>'collection'='inventoryMovements'
      and mutation->'payload'->>'sourceType' not in ('MirfePreparation','LegacyInventoryBootstrap')
  ) then raise exception 'unauthorized MIRFE inventory movement source'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_mutations) mutation
    where mutation->>'collection'='inventoryMovements'
    group by mutation->'payload'->>'lotId'
    having count(*) filter (where mutation->'payload'->>'sourceType'='LegacyInventoryBootstrap')>1
  ) then raise exception 'duplicate MIRFE legacy inventory bootstrap'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_mutations) lot_mutation
    where lot_mutation->>'collection'='inventoryLots'
      and not exists (
        select 1 from jsonb_array_elements(p_mutations) movement
        where movement->>'collection'='inventoryMovements'
          and movement->'payload'->>'lotId'=lot_mutation->>'recordId'
          and movement->'payload'->>'sourceType'='MirfePreparation'
          and movement->'payload'->>'sourceId'=p_preparation_id
      )
  ) then raise exception 'each MIRFE lot requires an operational consumption'; end if;

  if (
    select count(*)<>count(distinct jsonb_build_array(mutation->>'collection',mutation->>'recordId'))
    from jsonb_array_elements(p_mutations) mutation
  ) then raise exception 'duplicate MIRFE inventory mutation identity'; end if;

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
      raise exception 'invalid MIRFE inventory mutation';
    end if;
    if v_collection not in ('inventoryLots','inventoryMovements','tankPreparations','costEntries','workOrders') then
      raise exception 'collection is outside MIRFE inventory transaction boundary';
    end if;
    if coalesce(nullif(v_payload->>'organizationId',''),nullif(v_payload->>'companyId',''),nullif(v_payload->>'_organizationId','')) is distinct from p_organization_id::text
      or (v_payload ? 'organizationId' and nullif(v_payload->>'organizationId','') is distinct from p_organization_id::text)
      or (v_payload ? 'companyId' and nullif(v_payload->>'companyId','') is distinct from p_organization_id::text)
      or (v_payload ? '_organizationId' and nullif(v_payload->>'_organizationId','') is distinct from p_organization_id::text)
    then
      raise exception 'MIRFE inventory mutation organization mismatch';
    end if;
    if nullif(v_payload->>'siteId','') is distinct from v_site_id then
      raise exception 'MIRFE inventory mutation site mismatch';
    end if;
    if v_collection='inventoryLots' and coalesce((v_payload->>'quantity')::numeric,-1)<0 then
      raise exception 'MIRFE inventory lot cannot become negative';
    end if;
    if v_collection='inventoryMovements' then
      if v_payload->>'sourceType'='MirfePreparation' then
        if v_payload->>'type' is distinct from 'Consumo'
          or v_payload->>'sourceId' is distinct from p_preparation_id
          or nullif(v_payload->>'lotId','') is null
          or nullif(v_payload->>'productId','') is null
          or coalesce((v_payload->>'quantity')::numeric<=0,true)
          or (v_payload->>'signedQuantity')::numeric is distinct from (-1*(v_payload->>'quantity')::numeric)
          or (v_payload->>'balanceAfter')::numeric is distinct from ((v_payload->>'balanceBefore')::numeric+(v_payload->>'signedQuantity')::numeric)
          or coalesce((v_payload->>'balanceAfter')::numeric<0,true)
        then raise exception 'invalid MIRFE inventory movement'; end if;
      elsif v_payload->>'sourceType'='LegacyInventoryBootstrap' then
        if v_payload->>'type' is distinct from 'Saldo inicial'
          or v_payload->>'sourceId' is distinct from v_payload->>'lotId'
          or v_payload->>'id' is distinct from ('inventory-opening:'||p_organization_id::text||':'||(v_payload->>'lotId'))
          or nullif(v_payload->>'lotId','') is null
          or nullif(v_payload->>'productId','') is null
          or coalesce((v_payload->>'quantity')::numeric<=0,true)
          or (v_payload->>'signedQuantity')::numeric is distinct from (v_payload->>'quantity')::numeric
          or (v_payload->>'balanceBefore')::numeric is distinct from 0
          or (v_payload->>'balanceAfter')::numeric is distinct from (v_payload->>'quantity')::numeric
          or (v_payload->>'ledgerSequence')::bigint is distinct from 1
          or coalesce(nullif(btrim(v_payload->>'previousMovementId'),''),'')<>''
        then raise exception 'invalid MIRFE legacy inventory bootstrap'; end if;
      else
        raise exception 'invalid MIRFE inventory movement';
      end if;
    end if;
    if v_collection='tankPreparations' and (v_record_id<>p_preparation_id or v_payload->>'status' is distinct from 'Preparada') then
      raise exception 'invalid prepared MIRFE preparation';
    end if;
    if v_collection='workOrders' and (
      v_payload->>'sourceType' is distinct from 'MirfePreparation'
      or v_payload->>'sourceId' is distinct from p_preparation_id
      or v_payload->>'preparationId' is distinct from p_preparation_id
    ) then raise exception 'invalid MIRFE work order'; end if;
    if v_collection='costEntries' and (
      v_payload->>'sourceType' is distinct from 'MirfePreparation'
      or v_payload->>'sourceId' is distinct from p_preparation_id
      or coalesce((v_payload->>'amount')::numeric<=0,true)
    ) then raise exception 'invalid MIRFE cost entry'; end if;
    if v_collection in ('inventoryMovements','costEntries','workOrders') and v_base_version<>0 then
      raise exception 'new MIRFE consequence must start at version zero';
    end if;

    select * into v_record
    from public.erp_records
    where organization_id=p_organization_id and collection=v_collection and record_id=v_record_id
    for update;

    if found and (v_record.version<>v_base_version or v_collection in ('inventoryMovements','costEntries','workOrders')) then
      raise exception 'MIRFE_INVENTORY_VERSION_CONFLICT:%:%:%',v_collection,v_record_id,v_record.version using errcode='40001';
    end if;
    if not found and v_collection in ('inventoryLots','tankPreparations') then
      raise exception 'MIRFE_INVENTORY_VERSION_CONFLICT:%:%:missing',v_collection,v_record_id using errcode='40001';
    end if;
    if not found and v_base_version<>0 then
      raise exception 'MIRFE_INVENTORY_VERSION_CONFLICT:%:%:missing',v_collection,v_record_id using errcode='40001';
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_mutations) mutation
    join public.erp_records current_preparation
      on current_preparation.organization_id=p_organization_id
      and current_preparation.collection='tankPreparations'
      and current_preparation.record_id=p_preparation_id
    where mutation->>'collection'='tankPreparations'
      and mutation->>'recordId'=p_preparation_id
      and (
        current_preparation.deleted_at is not null
        or current_preparation.payload->>'status' is distinct from 'Pendiente'
        or (
          current_preparation.payload-array['status','items','totalCost','preparedAt','preparedBy','commandReceipts','organizationId','companyId','_organizationId','_syncVersion','_updatedAt']::text[]
        ) is distinct from (
          mutation->'payload'-array['status','items','totalCost','preparedAt','preparedBy','commandReceipts','organizationId','companyId','_organizationId','_syncVersion','_updatedAt']::text[]
        )
      )
  ) then raise exception 'remote MIRFE preparation is not pending or was altered'; end if;

  if exists (
    with first_movement as (
      select distinct on (mutation->'payload'->>'lotId')
        mutation->'payload'->>'lotId' lot_id,
        mutation->'payload' payload,
        case when mutation->'payload'->>'sourceType'='LegacyInventoryBootstrap'
          then (mutation->'payload'->>'balanceAfter')::numeric
          else (mutation->'payload'->>'balanceBefore')::numeric
        end expected_current_balance
      from jsonb_array_elements(p_mutations) mutation
      where mutation->>'collection'='inventoryMovements'
      order by mutation->'payload'->>'lotId',(mutation->'payload'->>'ledgerSequence')::bigint
    )
    select 1
    from jsonb_array_elements(p_mutations) lot_mutation
    left join first_movement movement on movement.lot_id=lot_mutation->>'recordId'
    left join public.erp_records current_lot
      on current_lot.organization_id=p_organization_id
      and current_lot.collection='inventoryLots'
      and current_lot.record_id=lot_mutation->>'recordId'
    where lot_mutation->>'collection'='inventoryLots'
      and (
        movement.payload is null
        or current_lot.record_id is null
        or current_lot.deleted_at is not null
        or (current_lot.payload->>'quantity')::numeric<>movement.expected_current_balance
        or current_lot.payload->>'productId' is distinct from movement.payload->>'productId'
        or current_lot.payload->>'siteId' is distinct from movement.payload->>'siteId'
        or (
          current_lot.payload-array['quantity','updatedAt','organizationId','companyId','_organizationId','_syncVersion','_updatedAt']::text[]
        ) is distinct from (
          lot_mutation->'payload'-array['quantity','updatedAt','organizationId','companyId','_organizationId','_syncVersion','_updatedAt']::text[]
        )
      )
  ) then raise exception 'remote MIRFE inventory lot balance mismatch'; end if;

  if exists (
    with movement_rows as (
      select
        mutation->'payload' payload,
        (mutation->'payload'->>'balanceBefore')::numeric balance_before,
        (mutation->'payload'->>'balanceAfter')::numeric balance_after,
        (mutation->'payload'->>'ledgerSequence')::bigint ledger_sequence,
        lag((mutation->'payload'->>'balanceAfter')::numeric) over (
          partition by mutation->'payload'->>'lotId' order by (mutation->'payload'->>'ledgerSequence')::bigint
        ) previous_after,
        lag(mutation->'payload'->>'id') over (
          partition by mutation->'payload'->>'lotId' order by (mutation->'payload'->>'ledgerSequence')::bigint
        ) previous_id,
        lag((mutation->'payload'->>'ledgerSequence')::bigint) over (
          partition by mutation->'payload'->>'lotId' order by (mutation->'payload'->>'ledgerSequence')::bigint
        ) previous_sequence
      from jsonb_array_elements(p_mutations) mutation
      where mutation->>'collection'='inventoryMovements'
    )
    select 1 from movement_rows
    where previous_after is not null and (
      balance_before<>previous_after
      or ledger_sequence<>previous_sequence+1
      or payload->>'previousMovementId' is distinct from previous_id
    )
  ) then raise exception 'MIRFE inventory movement chain is discontinuous'; end if;

  if exists (
    with last_movement as (
      select distinct on (mutation->'payload'->>'lotId')
        mutation->'payload'->>'lotId' lot_id,
        mutation->'payload'->>'productId' product_id,
        mutation->'payload'->>'siteId' site_id,
        (mutation->'payload'->>'balanceAfter')::numeric balance_after
      from jsonb_array_elements(p_mutations) mutation
      where mutation->>'collection'='inventoryMovements'
      order by mutation->'payload'->>'lotId',(mutation->'payload'->>'ledgerSequence')::bigint desc
    )
    select 1
    from last_movement movement
    left join lateral (
      select mutation->'payload' payload
      from jsonb_array_elements(p_mutations) mutation
      where mutation->>'collection'='inventoryLots' and mutation->>'recordId'=movement.lot_id
      limit 1
    ) lot on true
    where lot.payload is null
      or (lot.payload->>'quantity')::numeric<>movement.balance_after
      or lot.payload->>'productId'<>movement.product_id
      or lot.payload->>'siteId'<>movement.site_id
  ) then raise exception 'MIRFE inventory lot and movement mismatch'; end if;

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

  insert into public.mirfe_inventory_executions(
    organization_id,command_id,signature,preparation_id,site_id,result,executed_by
  ) values (
    p_organization_id,p_command_id,p_signature,p_preparation_id,v_site_id,v_records,v_user_id
  );

  return query select 'applied'::text,v_records,false;
end;
$$;

revoke all on function public.commit_mirfe_inventory_execution(text,uuid,text,text,jsonb) from public, anon;
grant execute on function public.commit_mirfe_inventory_execution(text,uuid,text,text,jsonb) to authenticated;