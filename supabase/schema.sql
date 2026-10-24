-- Execute este arquivo no SQL Editor do projeto Supabase da Sara.
-- O navegador nunca recebe a chave service_role/secret.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  service text not null check (service in (
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
