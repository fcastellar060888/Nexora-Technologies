create table if not exists public.documents (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  site_id uuid,
  entity_type text not null check (length(trim(entity_type)) > 0),
  entity_id text not null check (length(trim(entity_id)) > 0),
  name text not null check (length(trim(name)) > 0),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  checksum_sha256 text not null check (checksum_sha256 ~ '^[0-9a-f]{64}$'),
  storage_bucket text not null default 'documents' check (storage_bucket = 'documents'),
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','active','archived')),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  unique (organization_id, storage_path)
);

create index if not exists documents_entity_lookup
  on public.documents (organization_id, entity_type, entity_id, status, created_at desc);

alter table public.documents enable row level security;

create policy documents_member_read on public.documents
for select to authenticated
using (public.is_org_member(organization_id));

create policy documents_member_insert on public.documents
for insert to authenticated
with check (
  public.is_org_member(organization_id)
  and created_by = auth.uid()
  and split_part(storage_path, '/', 1) = organization_id::text
);

create policy documents_member_update on public.documents
for update to authenticated
using (public.is_org_member(organization_id))
with check (
  public.is_org_member(organization_id)
  and split_part(storage_path, '/', 1) = organization_id::text
  and status in ('pending','active','archived')
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400,
  array['application/pdf','image/jpeg','image/png','image/webp','image/heic','video/mp4','video/quicktime']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy documents_storage_member_read on storage.objects
for select to authenticated
using (
  bucket_id = 'documents'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then public.is_org_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy documents_storage_member_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'documents'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then public.is_org_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

create policy documents_storage_member_update on storage.objects
for update to authenticated
using (
  bucket_id = 'documents'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then public.is_org_member(((storage.foldername(name))[1])::uuid)
    else false
  end
)
with check (
  bucket_id = 'documents'
  and case
    when coalesce((storage.foldername(name))[1], '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then public.is_org_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

-- No DELETE policy is created for documents or storage.objects.
-- Business lifecycle is archive; physical purge requires a privileged retention process.
