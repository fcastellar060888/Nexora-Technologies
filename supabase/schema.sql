create table organizations(id uuid primary key default gen_random_uuid(),name text not null,tax_id text,created_at timestamptz default now());
create table farms(id uuid primary key default gen_random_uuid(),organization_id uuid references organizations(id) on delete cascade,name text not null);
create table sites(id uuid primary key default gen_random_uuid(),farm_id uuid references farms(id) on delete cascade,name text not null);
create table houses(id uuid primary key default gen_random_uuid(),site_id uuid references sites(id) on delete cascade,name text not null,layout text not null);
create table beds(id uuid primary key default gen_random_uuid(),house_id uuid references houses(id) on delete cascade,name text not null,rows_count integer not null,plants_per_row integer not null,active_plants integer not null);
create table plant_positions(id uuid primary key default gen_random_uuid(),bed_id uuid references beds(id) on delete cascade,row_number integer not null,position_number integer not null,active boolean default true,genetic text,status text);
create table findings(id uuid primary key default gen_random_uuid(),plant_position_id uuid references plant_positions(id) on delete cascade,finding_type text not null,severity integer default 1,status text default 'Activo',finding_date date default current_date);

create table if not exists mirfe_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  name text not null,
  category text not null,
  genetic_id uuid references genetics(id),
  stage text,
  trigger_variable text,
  trigger_operator text,
  trigger_value numeric,
  target_value numeric,
  objective text,
  review_hours integer,
  active boolean default true
);

create table if not exists mirfe_monitoring (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  house_id uuid references houses(id) on delete cascade,
  bed_id uuid references beds(id),
  genetic_id uuid references genetics(id),
  monitoring_date date,
  stage text,
  week integer,
  temperature_c numeric,
  humidity_percent numeric,
  vpd_kpa numeric,
  ppfd numeric,
  volume_applied_l numeric,
  drain_percent numeric,
  ec_input numeric,
  ec_drain numeric,
  delta_ec numeric,
  ph_input numeric,
  ph_drain numeric,
  n_ppm numeric, p_ppm numeric, k_ppm numeric,
  ca_ppm numeric, mg_ppm numeric, s_ppm numeric,
  diagnosis text,
  created_at timestamptz default now()
);

create table if not exists mirfe_reinforcements (
  id uuid primary key default gen_random_uuid(),
  monitoring_id uuid references mirfe_monitoring(id),
  program_id uuid references mirfe_programs(id),
  site_id uuid references sites(id),
  house_id uuid references houses(id),
  bed_id uuid references beds(id),
  genetic_id uuid references genetics(id),
  reinforcement_date date,
  stage text,
  week integer,
  category text,
  reason text,
  trigger_variable text,
  observed_value numeric,
  target_value numeric,
  product_id uuid references products(id),
  objective text,
  dose numeric,
  dose_unit text,
  volume_prepared_l numeric,
  quantity_applied numeric,
  application_route text,
  ec_before numeric,
  ec_after numeric,
  ph_before numeric,
  ph_after numeric,
  responsible text,
  status text,
  result text,
  next_review date,
  notes text,
  created_at timestamptz default now()
);

create table if not exists erp_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table erp_snapshots enable row level security;
create policy "users own snapshot" on erp_snapshots
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists app_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'Operario',
  site_id uuid,
  active boolean default true,
  created_at timestamptz default now()
);
alter table app_profiles enable row level security;
create policy "profiles readable authenticated" on app_profiles
for select using (auth.role() = 'authenticated');

-- v2.1 relational core
create table if not exists audit_log(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references organizations(id) on delete cascade,
 user_id uuid references auth.users(id),
 module text, action text, detail text,
 created_at timestamptz default now()
);
create table if not exists attachments(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references organizations(id) on delete cascade,
 entity_type text not null, entity_id uuid not null,
 storage_path text not null, file_name text, mime_type text,
 uploaded_by uuid references auth.users(id),
 created_at timestamptz default now()
);
create table if not exists inventory_movements(
 id uuid primary key default gen_random_uuid(),
 inventory_lot_id uuid references inventory_lots(id) on delete cascade,
 movement_type text not null, quantity numeric not null,
 supplier text, reference text, responsible text, notes text,
 movement_date date default current_date, created_at timestamptz default now()
);
create table if not exists production_flows(
 id uuid primary key default gen_random_uuid(),
 site_id uuid references sites(id), genetic_id uuid references genetics(id),
 code text not null, plants integer, stage text not null,
 wet_weight numeric, history jsonb default '[]'::jsonb,
 created_at timestamptz default now()
);
create table if not exists irrigation_applications(
 id uuid primary key default gen_random_uuid(),
 site_id uuid references sites(id), house_id uuid references houses(id),
 formulation_id uuid, application_date date, volume_l numeric,
 ec numeric, ph numeric, responsible text, status text, notes text,
 created_at timestamptz default now()
);

-- v2.2 pilot controls
create table if not exists user_site_access(
 user_id uuid references auth.users(id) on delete cascade,
 site_id uuid references sites(id) on delete cascade,
 role text not null,
 active boolean default true,
 primary key(user_id,site_id)
);
alter table user_site_access enable row level security;
create policy "own site access readable" on user_site_access for select using(auth.uid()=user_id);

create table if not exists formula_approvals(
 id uuid primary key default gen_random_uuid(),
 formulation_id uuid not null,
 approved_by uuid references auth.users(id),
 status text not null check(status in('Borrador','En revisión','Aprobada','Rechazada')),
 notes text,
 approved_at timestamptz,
 created_at timestamptz default now()
);
alter table formula_approvals enable row level security;
create policy "authenticated approvals readable" on formula_approvals for select using(auth.role()='authenticated');

-- v3.0 propagation and lineage
create table if not exists mother_plants(
 id uuid primary key default gen_random_uuid(),
 site_id uuid references sites(id), genetic_id uuid references genetics(id),
 name text not null, sequence integer, start_date date, status text,
 health_status text, source text, notes text, created_at timestamptz default now()
);
create table if not exists propagation_batches(
 id uuid primary key default gen_random_uuid(),
 mother_plant_id uuid references mother_plants(id),
 site_id uuid references sites(id), code text unique not null,
 cut_date date, quantity integer, substrate text, hormone text,
 operator text, expected_root_date date, notes text, created_at timestamptz default now()
);
create table if not exists propagation_units(
 id uuid primary key default gen_random_uuid(),
 batch_id uuid references propagation_batches(id) on delete cascade,
 code text unique not null, status text, cut_date date, root_date date,
 vegetative_date date, flowering_date date, discard_reason text,
 plant_position_id uuid references plant_positions(id), created_at timestamptz default now()
);
create table if not exists phase_transitions(
 id uuid primary key default gen_random_uuid(),
 entity_type text default 'plant', entity_id uuid not null,
 from_phase text, to_phase text, transition_date date,
 site_id uuid references sites(id), house_id uuid references houses(id),
 bed_id uuid references beds(id), responsible text, notes text,
 created_at timestamptz default now()
);

-- V6 material vegetal, producto terminado y comercial
create table if not exists finished_goods(
 id uuid primary key default gen_random_uuid(),
 lot_id uuid not null, classification text not null, packed_grams numeric not null,
 available_grams numeric not null, reserved_grams numeric default 0, sold_grams numeric default 0,
 warehouse text, location text, packed_at date, target_price_per_gram numeric,
 currency text default 'COP', exchange_rate numeric default 1, notes text, created_at timestamptz default now()
);
create table if not exists sales(
 id uuid primary key default gen_random_uuid(), lot_id uuid not null, classification text, customer text,
 sale_date date, grams numeric not null, price_per_gram numeric not null, currency text not null,
 exchange_rate numeric not null, total_original numeric not null, total_base numeric not null, reference text, notes text, created_at timestamptz default now()
);
create table if not exists currencies(
 code text primary key, name text not null, symbol text, rate_to_base numeric not null default 1, active boolean default true, updated_at timestamptz default now()
);
