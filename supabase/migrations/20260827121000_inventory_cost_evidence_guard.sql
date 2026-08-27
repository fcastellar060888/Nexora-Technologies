create or replace function public.enforce_inventory_cost_entry_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payload jsonb := new.payload;
  v_ids text[];
  v_id_count integer;
  v_distinct_count integer;
  v_resolved_count integer;
  v_amount numeric;
  v_expected numeric;
  v_source_type text;
  v_source_id text;
  v_inventory_backed boolean := coalesce(v_payload->>'module','') in ('MIPE','MIRFE');
begin
  if new.collection <> 'costEntries' or new.deleted_at is not null then
    return null;
  end if;

  if jsonb_typeof(v_payload->'inventoryMovementIds') = 'array' then
    select coalesce(array_agg(value order by ordinality), array[]::text[])
      into v_ids
    from jsonb_array_elements_text(v_payload->'inventoryMovementIds') with ordinality as item(value, ordinality);
  elsif nullif(btrim(v_payload->>'inventoryMovementId'),'') is not null then
    v_ids := array[v_payload->>'inventoryMovementId'];
  elsif v_inventory_backed then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:no-movements' using errcode='23514';
  else
    return null;
  end if;

  v_id_count := coalesce(cardinality(v_ids),0);
  if v_id_count = 0 then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:no-movements' using errcode='23514';
  end if;

  select count(distinct value) into v_distinct_count from unnest(v_ids) value;
  if v_distinct_count <> v_id_count or exists(select 1 from unnest(v_ids) value where nullif(btrim(value),'') is null) then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:duplicate-or-empty-movement' using errcode='23514';
  end if;

  if v_payload ? 'organizationId' and nullif(v_payload->>'organizationId','') is distinct from new.organization_id::text then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:organization-mismatch' using errcode='23514';
  end if;

  select count(*),
         round(sum(abs((record.payload->>'quantity')::numeric) * (record.payload->>'unitCost')::numeric),6)
    into v_resolved_count, v_expected
  from public.erp_records record
  where record.organization_id = new.organization_id
    and record.collection = 'inventoryMovements'
    and record.record_id = any(v_ids)
    and record.deleted_at is null
    and nullif(record.payload->>'quantity','') is not null
    and nullif(record.payload->>'unitCost','') is not null
    and (record.payload->>'quantity')::numeric > 0
    and (record.payload->>'unitCost')::numeric >= 0;

  if v_resolved_count <> v_id_count then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:movement-missing-or-invalid' using errcode='23514';
  end if;

  begin
    v_amount := round((v_payload->>'amount')::numeric,6);
  exception when others then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:amount' using errcode='23514';
  end;

  if v_amount is distinct from coalesce(v_expected,0) then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:amount-mismatch' using errcode='23514';
  end if;

  v_source_type := nullif(btrim(v_payload->>'sourceType'),'');
  v_source_id := nullif(btrim(v_payload->>'sourceId'),'');
  if (v_source_type is null) <> (v_source_id is null) then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:incomplete-source' using errcode='23514';
  end if;

  if v_source_type is not null and exists(
    select 1
    from public.erp_records record
    where record.organization_id = new.organization_id
      and record.collection = 'inventoryMovements'
      and record.record_id = any(v_ids)
      and record.deleted_at is null
      and (record.payload->>'sourceType' is distinct from v_source_type
        or record.payload->>'sourceId' is distinct from v_source_id)
  ) then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:source-mismatch' using errcode='23514';
  end if;

  if tg_op = 'UPDATE' and old.collection = 'costEntries' and old.deleted_at is null
    and (
      old.payload->'inventoryMovementIds' is distinct from new.payload->'inventoryMovementIds'
      or old.payload->>'inventoryMovementId' is distinct from new.payload->>'inventoryMovementId'
      or old.payload->>'amount' is distinct from new.payload->>'amount'
      or old.payload->>'sourceType' is distinct from new.payload->>'sourceType'
      or old.payload->>'sourceId' is distinct from new.payload->>'sourceId'
    )
  then
    raise exception 'INVENTORY_COST_EVIDENCE_INVALID:immutable-evidence' using errcode='23514';
  end if;

  return null;
end;
$$;

revoke all on function public.enforce_inventory_cost_entry_evidence() from public, anon, authenticated;

drop trigger if exists erp_records_inventory_cost_evidence_guard on public.erp_records;
create constraint trigger erp_records_inventory_cost_evidence_guard
after insert or update on public.erp_records
deferrable initially deferred
for each row
when (new.collection = 'costEntries')
execute function public.enforce_inventory_cost_entry_evidence();
