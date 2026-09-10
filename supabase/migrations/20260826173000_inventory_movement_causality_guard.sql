-- M3.3 F007 — server-side authority for immutable inventory movement evidence.
-- INSERT validates against canonical Product/Lot authority. MIPE treatment
-- movements use the already-approved Treatment productSnapshot when present,
-- so later Product edits cannot re-price historical execution evidence.
-- UPDATE preserves the historical snapshot.

create or replace function public.guard_inventory_movement_causality()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_lot public.erp_records%rowtype;
  v_product public.erp_records%rowtype;
  v_treatment public.erp_records%rowtype;
  v_snapshot jsonb;
  v_lot_id text:=nullif(btrim(new.payload->>'lotId'),'');
  v_product_id text:=nullif(btrim(new.payload->>'productId'),'');
  v_source_type text:=nullif(btrim(new.payload->>'sourceType'),'');
  v_source_id text:=nullif(btrim(new.payload->>'sourceId'),'');
  v_expected_unit text;
  v_expected_cost numeric;
begin
  if new.collection <> 'inventoryMovements' or new.deleted_at is not null then return new; end if;

  if tg_op='UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.payload->>'lotId' is distinct from new.payload->>'lotId'
      or old.payload->>'productId' is distinct from new.payload->>'productId'
      or old.payload->>'unit' is distinct from new.payload->>'unit'
      or old.payload->>'unitCost' is distinct from new.payload->>'unitCost'
      or old.payload->>'sourceType' is distinct from new.payload->>'sourceType'
      or old.payload->>'sourceId' is distinct from new.payload->>'sourceId'
    then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:immutable'; end if;
    return new;
  end if;

  if v_lot_id is null or v_product_id is null then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:identity'; end if;
  if v_source_type is null then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:source-type'; end if;
  if v_source_type<>'Manual' and v_source_id is null then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:source-id'; end if;

  select * into v_lot from public.erp_records r
  where r.organization_id=new.organization_id and r.collection='inventoryLots' and r.record_id=v_lot_id and r.deleted_at is null;
  if not found then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:lot:%',v_lot_id; end if;
  if nullif(v_lot.payload->>'productId','') is distinct from v_product_id then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:lot-product'; end if;

  select * into v_product from public.erp_records r
  where r.organization_id=new.organization_id and r.collection='products' and r.record_id=v_product_id and r.deleted_at is null;
  if not found then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:product:%',v_product_id; end if;

  if v_source_type='MipeTreatment' then
    select * into v_treatment from public.erp_records r
    where r.organization_id=new.organization_id and r.collection='treatments' and r.record_id=v_source_id and r.deleted_at is null;
    if not found then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:mipe-treatment:%',v_source_id; end if;
    if nullif(btrim(v_treatment.payload->>'productId'),'') is distinct from v_product_id then
      raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:mipe-treatment-product';
    end if;
    v_snapshot:=v_treatment.payload->'productSnapshot';
  end if;

  if jsonb_typeof(v_snapshot)='object' and nullif(btrim(v_snapshot->>'id'),'') is not null then
    if nullif(btrim(v_snapshot->>'id'),'') is distinct from v_product_id then
      raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:mipe-snapshot-product';
    end if;
    if nullif(btrim(v_snapshot->>'organizationId'),'') is not null
      and nullif(btrim(v_snapshot->>'organizationId'),'') is distinct from new.organization_id::text
    then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:mipe-snapshot-organization'; end if;
    v_expected_unit:=coalesce(nullif(btrim(v_lot.payload->>'unit'),''),nullif(btrim(v_snapshot->>'unit'),''));
    begin
      v_expected_cost:=coalesce(nullif(v_snapshot->>'cost','')::numeric,0);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:mipe-snapshot-cost';
    end;
    if v_expected_cost<0 then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:mipe-snapshot-cost'; end if;
  else
    v_expected_unit:=coalesce(nullif(btrim(v_lot.payload->>'unit'),''),nullif(btrim(v_product.payload->>'unit'),''));
    begin
      v_expected_cost:=coalesce(nullif(v_product.payload->>'cost','')::numeric,0);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:product-cost';
    end;
    if v_expected_cost<0 then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:product-cost'; end if;
  end if;

  if v_expected_unit is null or nullif(btrim(new.payload->>'unit'),'') is distinct from v_expected_unit then
    raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:unit';
  end if;
  begin
    if (new.payload->>'unitCost')::numeric is distinct from v_expected_cost then raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:unit-cost'; end if;
  exception when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'INVENTORY_MOVEMENT_CAUSALITY_CONFLICT:unit-cost';
  end;

  return new;
end;
$$;

revoke all on function public.guard_inventory_movement_causality() from public,anon,authenticated;
drop trigger if exists trg_inventory_movement_causality on public.erp_records;
create trigger trg_inventory_movement_causality
before insert or update on public.erp_records
for each row when (new.collection='inventoryMovements')
execute function public.guard_inventory_movement_causality();