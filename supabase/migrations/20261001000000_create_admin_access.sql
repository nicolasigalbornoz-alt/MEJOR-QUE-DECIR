-- Primer acceso administrativo: una única cuenta creada manualmente.
-- No existe alta pública ni política de escritura para admin_users.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

create policy "Administrators can read their own access grant"
  on public.admin_users
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

comment on table public.admin_users is
  'Allowlist de acceso administrativo; altas gestionadas manualmente por el propietario del proyecto.';
