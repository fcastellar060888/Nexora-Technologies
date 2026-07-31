create table if not exists public.initial_data_migrations (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  status text not null check (status in ('completed','rolled_back')),
  backup_hash text not null default '',
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz
);

create table if not exists public.initial_data_migration_records (
  migration_id uuid not null references public.initial_data_migrations(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  collection text not null,
  record_id text not null,
  action text not null check (action in ('insert','update')),
  previous_payload jsonb,
  previous_version bigint,
  primary key (migration_id, collection, record_id)
);

alter table public.initial_data_migrations enable row level security;
alter table public.initial_data_migration_records enable row level security;

create policy "members read initial migrations" on public.initial_data_migrations
for select using (exists(select 1 from public.memberships m where m.organization_id=initial_data_migrations.organization_id and m.user_id=auth.uid() and m.status='active'));

create policy "members read initial migration records" on public.initial_data_migration_records
for select using (exists(select 1 from public.memberships m where m.organization_id=initial_data_migration_records.organization_id and m.user_id=auth.uid() and m.status='active'));

create or replace function public.can_manage_initial_migration(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(
  select 1 from public.memberships m
  where m.organization_id=p_organization_id and m.user_id=auth.uid() and m.status='active'
  and (m.role in ('owner','admin','administrator') or 'manage_settings'=any(coalesce(m.permission_overrides,'{}'::text[])))
 );
$$;

create or replace function public.preview_initial_migration(p_organization_id uuid,p_migration_id uuid,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_inserted integer:=0;v_updated integer:=0;v_unchanged integer:=0;v_duplicates integer:=0;v_total integer:=0;
begin
 if not public.can_manage_initial_migration(p_organization_id) then raise exception 'No tienes permiso para migrar esta organización'; end if;
 if jsonb_typeof(p_rows)<>'array' then raise exception 'El lote de migración debe ser un arreglo'; end if;
 select count(*) into v_total from jsonb_array_elements(p_rows);
 select count(*)-count(distinct concat(value->>'collection','/',value->>'record_id')) into v_duplicates from jsonb_array_elements(p_rows);
 select count(*) filter(where r.organization_id is null),count(*) filter(where r.organization_id is not null and r.payload is distinct from x.value->'payload'),count(*) filter(where r.organization_id is not null and r.payload is not distinct from x.value->'payload')
 into v_inserted,v_updated,v_unchanged
 from jsonb_array_elements(p_rows) x(value)
 left join public.erp_records r on r.organization_id=p_organization_id and r.collection=x.value->>'collection' and r.record_id=x.value->>'record_id';
 return jsonb_build_object('migrationId',p_migration_id,'total',v_total,'inserted',v_inserted,'updated',v_updated,'unchanged',v_unchanged,'duplicates',v_duplicates,'safe',v_duplicates=0);
end;$$;

create or replace function public.execute_initial_migration(p_organization_id uuid,p_migration_id uuid,p_rows jsonb,p_backup_hash text,p_confirmation_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 x jsonb;v_existing public.erp_records%rowtype;v_inserted integer:=0;v_updated integer:=0;
begin
 if not public.can_manage_initial_migration(p_organization_id) then raise exception 'No tienes permiso para migrar esta organización'; end if;
 if p_confirmation_token<>'MIGRAR' then raise exception 'Confirmación inválida'; end if;
 if coalesce(p_backup_hash,'')='' then raise exception 'Debes registrar el hash del respaldo'; end if;
 if exists(select 1 from public.initial_data_migrations where id=p_migration_id) then raise exception 'Esta migración ya fue ejecutada'; end if;
 if (select count(*)-count(distinct concat(value->>'collection','/',value->>'record_id')) from jsonb_array_elements(p_rows))>0 then raise exception 'El lote contiene identificadores duplicados'; end if;
 insert into public.initial_data_migrations(id,organization_id,created_by,status,backup_hash) values(p_migration_id,p_organization_id,auth.uid(),'completed',p_backup_hash);
 for x in select value from jsonb_array_elements(p_rows) loop
  select * into v_existing from public.erp_records where organization_id=p_organization_id and collection=x->>'collection' and record_id=x->>'record_id' for update;
  if not found then
   insert into public.initial_data_migration_records(migration_id,organization_id,collection,record_id,action) values(p_migration_id,p_organization_id,x->>'collection',x->>'record_id','insert');
   insert into public.erp_records(organization_id,collection,record_id,payload,version,updated_at,deleted_at) values(p_organization_id,x->>'collection',x->>'record_id',x->'payload',1,now(),null);
   v_inserted:=v_inserted+1;
  elsif v_existing.payload is distinct from x->'payload' then
   insert into public.initial_data_migration_records(migration_id,organization_id,collection,record_id,action,previous_payload,previous_version) values(p_migration_id,p_organization_id,x->>'collection',x->>'record_id','update',v_existing.payload,v_existing.version);
   update public.erp_records set payload=x->'payload',version=v_existing.version+1,updated_at=now(),deleted_at=null where organization_id=p_organization_id and collection=x->>'collection' and record_id=x->>'record_id';
   v_updated:=v_updated+1;
  end if;
 end loop;
 update public.initial_data_migrations set inserted_count=v_inserted,updated_count=v_updated where id=p_migration_id;
 return jsonb_build_object('migrationId',p_migration_id,'inserted',v_inserted,'updated',v_updated,'status','completed');
end;$$;

create or replace function public.rollback_initial_migration(p_organization_id uuid,p_migration_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare x record;v_removed integer:=0;v_restored integer:=0;
begin
 if not public.can_manage_initial_migration(p_organization_id) then raise exception 'No tienes permiso para revertir esta organización'; end if;
 if not exists(select 1 from public.initial_data_migrations where id=p_migration_id and organization_id=p_organization_id and status='completed') then raise exception 'La migración no existe o ya fue revertida'; end if;
 for x in select * from public.initial_data_migration_records where migration_id=p_migration_id order by action loop
  if x.action='insert' then delete from public.erp_records where organization_id=p_organization_id and collection=x.collection and record_id=x.record_id;v_removed:=v_removed+1;
  else update public.erp_records set payload=x.previous_payload,version=x.previous_version,updated_at=now() where organization_id=p_organization_id and collection=x.collection and record_id=x.record_id;v_restored:=v_restored+1;
  end if;
 end loop;
 update public.initial_data_migrations set status='rolled_back',rolled_back_at=now() where id=p_migration_id;
 return jsonb_build_object('migrationId',p_migration_id,'removed',v_removed,'restored',v_restored,'status','rolled_back');
end;$$;

grant execute on function public.preview_initial_migration(uuid,uuid,jsonb) to authenticated;
grant execute on function public.execute_initial_migration(uuid,uuid,jsonb,text,text) to authenticated;
grant execute on function public.rollback_initial_migration(uuid,uuid) to authenticated;
