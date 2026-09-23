-- Consultation attachments: private bucket + tenant-scoped RLS
-- Idempotent. Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultation-attachments',
  'consultation-attachments',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists encounter_attachments_tenant_isolation on public.encounter_attachments;
create policy encounter_attachments_tenant_isolation
  on public.encounter_attachments
  for all
  using (tenant_id = jwt_tenant_id())
  with check (tenant_id = jwt_tenant_id());

drop policy if exists consultation_attachments_read on storage.objects;
create policy consultation_attachments_read
  on storage.objects
  for select
  using (
    bucket_id = 'consultation-attachments'
    and (storage.foldername(name))[1] = jwt_tenant_id()::text
  );

drop policy if exists consultation_attachments_insert on storage.objects;
create policy consultation_attachments_insert
  on storage.objects
  for insert
  with check (
    bucket_id = 'consultation-attachments'
    and (storage.foldername(name))[1] = jwt_tenant_id()::text
  );

drop policy if exists consultation_attachments_update on storage.objects;
create policy consultation_attachments_update
  on storage.objects
  for update
  using (
    bucket_id = 'consultation-attachments'
    and (storage.foldername(name))[1] = jwt_tenant_id()::text
  );

drop policy if exists consultation_attachments_delete on storage.objects;
create policy consultation_attachments_delete
  on storage.objects
  for delete
  using (
    bucket_id = 'consultation-attachments'
    and (storage.foldername(name))[1] = jwt_tenant_id()::text
  );