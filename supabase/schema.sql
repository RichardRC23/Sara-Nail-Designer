-- Execute este arquivo no SQL Editor do projeto Supabase da Sara.
-- O navegador nunca recebe a chave service_role/secret.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  service text not null constraint appointments_service_check check (service in (
    'Banho de gel',
    'Molde F1',
    'Gel na tips',
    'Postiça realista',
    'Manutenção — Molde F1',
    'Manutenção — Gel na tips',
    'Manutenção — Banho de gel',
    -- Valores antigos permanecem válidos para não afetar pedidos já registrados.
    'Esmaltação em gel',
    'Nail art personalizada',
    'Alongamento'
  )),
  requested_date date not null check (requested_date >= current_date),
  requested_time time not null,
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'requested' check (status in ('requested', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Atualiza a lista permitida também em instalações que já tinham a tabela criada.
alter table public.appointments
  drop constraint if exists appointments_service_check;

alter table public.appointments
  add constraint appointments_service_check check (service in (
    'Banho de gel',
    'Molde F1',
    'Gel na tips',
    'Postiça realista',
    'Manutenção — Molde F1',
    'Manutenção — Gel na tips',
    'Manutenção — Banho de gel',
    'Esmaltação em gel',
    'Nail art personalizada',
    'Alongamento'
  ));

alter table public.appointments enable row level security;

revoke all on table public.appointments from anon, authenticated;
grant select, insert on table public.appointments to authenticated;

drop policy if exists "Clients can read their own appointment requests" on public.appointments;
create policy "Clients can read their own appointment requests"
  on public.appointments
  for select
  to authenticated
  using ((select auth.uid()) = customer_id);

drop policy if exists "Clients can create their own appointment requests" on public.appointments;
create policy "Clients can create their own appointment requests"
  on public.appointments
  for insert
  to authenticated
  with check (
    (select auth.uid()) = customer_id
    and status = 'requested'
    and requested_date >= current_date
  );

-- Fotos de perfil: bucket privado e cada cliente acessa apenas a própria pasta.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sara-avatars', 'sara-avatars', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Clients can read their own profile photos" on storage.objects;
create policy "Clients can read their own profile photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'sara-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Clients can upload their own profile photos" on storage.objects;
create policy "Clients can upload their own profile photos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'sara-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Clients can update their own profile photos" on storage.objects;
create policy "Clients can update their own profile photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'sara-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'sara-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Clients can delete their own profile photos" on storage.objects;
create policy "Clients can delete their own profile photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'sara-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
