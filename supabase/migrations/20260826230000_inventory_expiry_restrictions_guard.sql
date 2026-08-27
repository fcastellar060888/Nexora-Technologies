-- M3.3 F008 — server-side expiry restriction for inventory consumption.
-- Fail closed for Salida/Consumo after expiryDate while preserving Baja/Vencimiento
-- as append-only disposal evidence. Uses the movement's explicit operational date.

create or replace function public.guard_inventory_movement_expiry()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_lot public.erp_records%rowtype;
  v_lot_id text:=nullif(btrim(new.payload->>'lotId'),'');
  v_type text:=nullif(btrim(new.payload->>'type'),'');
  v_date_text text:=nullif(btrim(new.payload->>'date'),'');
  v_expiry_text text;
  v_date date;
  v_expiry date;
begin
  if new.collection <> 'inventoryMovements' or new.deleted_at is not null then return new; end if;

  -- Historical evidence is immutable with respect to the restriction decision.
  if tg_op='UPDATE' then
    if old.organization_id is distinct from new.organization_id
      or old.payload->>'lotId' is distinct from new.payload->>'lotId'
      or old.payload->>'type' is distinct from new.payload->>'type'
      or old.payload->>'date' is distinct from new.payload->>'date'
    then raise exception 'INVENTORY_MOVEMENT_EXPIRY_CONFLICT:immutable'; end if;
    return new;
  end if;

  if v_lot_id is null or v_type is null or v_date_text is null then
    raise exception 'INVENTORY_MOVEMENT_EXPIRY_CONFLICT:identity-date';
  end if;

  begin
    v_date:=v_date_text::date;
    if to_char(v_date,'YYYY-MM-DD') is distinct from v_date_text then
      raise exception 'INVENTORY_MOVEMENT_EXPIRY_CONFLICT:date';
    end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'INVENTORY_MOVEMENT_EXPIRY_CONFLICT:date';
  end;

  select * into v_lot from public.erp_records r
  where r.organization_id=new.organization_id
    and r.collection='inventoryLots'
    and r.record_id=v_lot_id
    and r.deleted_at is null;
  if not found then raise exception 'INVENTORY_MOVEMENT_EXPIRY_CONFLICT:lot:%',v_lot_id; end if;

  v_expiry_text:=nullif(btrim(v_lot.payload->>'expiryDate'),'');
  if v_expiry_text is null then return new; end if;
  begin
    v_expiry:=v_expiry_text::date;
    if to_char(v_expiry,'YYYY-MM-DD') is distinct from v_expiry_text then
      raise exception 'INVENTORY_MOVEMENT_EXPIRY_CONFLICT:expiry-date';
    end if;
  exception when invalid_datetime_format or datetime_field_overflow then
    raise exception 'INVENTORY_MOVEMENT_EXPIRY_CONFLICT:expiry-date';
  end;

  if v_type in ('Salida','Consumo') and v_date>v_expiry then
    raise exception 'INVENTORY_MOVEMENT_EXPIRY_CONFLICT:expired:%:%',v_lot_id,v_expiry_text;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_inventory_movement_expiry() from public,anon,authenticated;
drop trigger if exists trg_inventory_movement_expiry on public.erp_records;
create trigger trg_inventory_movement_expiry
before insert or update on public.erp_records
for each row when (new.collection='inventoryMovements')
execute function public.guard_inventory_movement_expiry();
