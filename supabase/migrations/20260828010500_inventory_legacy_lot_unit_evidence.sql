-- M33-F010: recover a legacy InventoryLot unit only when historical ledger evidence proves it.
-- We intentionally do not infer/backfill from the Product's current unit: doing so would fabricate history.
do $$
declare
  v_lot record;
  v_units text[];
  v_unit text;
  v_product_unit text;
begin
  for v_lot in
    select id, organization_id, payload
    from public.erp_records
    where collection = 'inventoryLots'
      and deleted_at is null
      and nullif(btrim(payload->>'unit'),'') is null
  loop
    select array_agg(distinct nullif(btrim(m.payload->>'unit'),''))
      filter (where nullif(btrim(m.payload->>'unit'),'') is not null)
      into v_units
    from public.erp_records m
    where m.organization_id = v_lot.organization_id
      and m.collection = 'inventoryMovements'
      and m.deleted_at is null
      and m.payload->>'lotId' = v_lot.id::text;

    -- No historical unit evidence: leave the legacy lot untouched.
    if coalesce(cardinality(v_units),0) = 0 then
      continue;
    end if;

    -- Contradictory historical evidence must be repaired explicitly, never guessed.
    if cardinality(v_units) <> 1 then
      raise exception 'INVENTORY_LEGACY_UNIT_CONFLICT:%', v_lot.id using errcode='23514';
    end if;

    v_unit := v_units[1];

    select nullif(btrim(p.payload->>'unit'),'')
      into v_product_unit
    from public.erp_records p
    where p.organization_id = v_lot.organization_id
      and p.collection = 'products'
      and p.deleted_at is null
      and p.id::text = v_lot.payload->>'productId';

    if v_product_unit is null then
      raise exception 'INVENTORY_LEGACY_UNIT_PRODUCT_MISSING:%', v_lot.id using errcode='23514';
    end if;
    if v_product_unit <> v_unit then
      raise exception 'INVENTORY_LEGACY_UNIT_PRODUCT_CONFLICT:%', v_lot.id using errcode='23514';
    end if;

    update public.erp_records
       set payload = jsonb_set(payload,'{unit}',to_jsonb(v_unit),true),
           updated_at = now()
     where id = v_lot.id
       and organization_id = v_lot.organization_id
       and collection = 'inventoryLots'
       and deleted_at is null
       and nullif(btrim(payload->>'unit'),'') is null;
  end loop;
end $$;
