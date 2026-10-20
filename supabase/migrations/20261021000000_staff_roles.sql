-- Equipo del panel con roles: admin, editor y lector (viewer).
--
-- Regla general:
--   lector  → ve todas las secciones del panel y descarga archivos;
--   editor  → además crea y edita registros y sube archivos;
--   admin   → además borra registros y gestiona usuarios.
--
-- Reemplaza la allowlist de una sola cuenta (admin_users). Las altas se hacen
-- por invitación desde el panel (servidor con clave de servicio) y el rol se
-- guarda en staff_members.

create table public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  display_name text not null default '' check (char_length(display_name) <= 120),
  email text not null default '' check (char_length(email) <= 254),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.staff_members (user_id, role, email, created_at)
select a.user_id, 'admin', coalesce(u.email, ''), a.created_at
from public.admin_users a
join auth.users u on u.id = a.user_id
on conflict (user_id) do nothing;

-- ---------- Funciones de autorización ----------

create or replace function private.staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff_members where user_id = (select auth.uid());
$$;

create or replace function private.can_read()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.staff_role() in ('admin', 'editor', 'viewer'), false);
$$;

create or replace function private.can_edit()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.staff_role() in ('admin', 'editor'), false);
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.staff_role() = 'admin', false);
$$;

revoke all on function private.staff_role(), private.can_read(), private.can_edit()
  from public, anon, authenticated;
grant execute on function private.staff_role(), private.can_read(), private.can_edit()
  to anon, authenticated;

-- Siempre tiene que quedar al menos un admin.
create or replace function private.keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    if not exists (
      select 1 from public.staff_members
      where role = 'admin' and user_id <> old.user_id
    ) then
      raise exception 'Tiene que quedar al menos una cuenta administradora.' using errcode = '42501';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger staff_members_keep_one_admin
  before update or delete on public.staff_members
  for each row execute function private.keep_one_admin();

alter table public.staff_members enable row level security;
revoke all on public.staff_members from anon, authenticated;
grant select, insert, update, delete on public.staff_members to authenticated;

create policy "Staff reads team"
  on public.staff_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.can_read()));
create policy "Admin adds team members"
  on public.staff_members for insert to authenticated with check ((select private.is_admin()));
create policy "Admin updates team members"
  on public.staff_members for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admin removes team members"
  on public.staff_members for delete to authenticated using ((select private.is_admin()));

-- ---------- Políticas del módulo del encuentro ----------
-- Las políticas públicas de lectura ("... or is_admin()") se mantienen. Se
-- reemplazan las de administración por la regla de roles.

drop policy "Only administrator manages events" on public.events;
drop policy "Only administrator manages forms" on public.forms;
drop policy "Only administrator manages form versions" on public.form_versions;
drop policy "Only administrator manages form questions" on public.form_questions;
drop policy "Only administrator manages question options" on public.form_question_options;
drop policy "Only administrator manages province catalog" on public.province_catalog;
drop policy "Only administrator manages commissions" on public.commissions;
drop policy "Only administrator manages workshops" on public.workshops;
drop policy "Only administrator reads submissions" on public.form_submissions;
drop policy "Only administrator manages submissions" on public.form_submissions;
drop policy "Only administrator reads attendee directory" on public.attendee_directory;
drop policy "Only administrator manages attendee directory" on public.attendee_directory;
drop policy "Only administrator manages acts" on public.commission_acts;
drop policy "Only administrator manages submission assignments" on public.submission_assignments;

do $$
declare
  table_name text;
begin
  -- Lectura para todo el equipo.
  foreach table_name in array array[
    'events', 'forms', 'form_versions', 'form_questions', 'form_question_options',
    'province_catalog', 'commissions', 'workshops', 'form_submissions',
    'attendee_directory', 'commission_acts', 'submission_assignments'
  ] loop
    execute format(
      'create policy "Staff reads %1$s" on public.%1$I for select to authenticated using ((select private.can_read()))',
      table_name
    );
  end loop;

  -- Alta y edición para editores y admins.
  foreach table_name in array array[
    'events', 'forms', 'form_versions', 'form_questions', 'form_question_options',
    'province_catalog', 'commissions', 'workshops', 'commission_acts', 'submission_assignments'
  ] loop
    execute format(
      'create policy "Editors insert %1$s" on public.%1$I for insert to authenticated with check ((select private.can_edit()))',
      table_name
    );
    execute format(
      'create policy "Editors update %1$s" on public.%1$I for update to authenticated using ((select private.can_edit())) with check ((select private.can_edit()))',
      table_name
    );
  end loop;

  -- Las versiones en borrador, sus preguntas y opciones son parte de la
  -- edición de un formulario: los editores pueden quitarlas.
  foreach table_name in array array['form_versions', 'form_questions', 'form_question_options', 'submission_assignments'] loop
    execute format(
      'create policy "Editors delete %1$s" on public.%1$I for delete to authenticated using ((select private.can_edit()))',
      table_name
    );
  end loop;

  -- Borrar registros principales queda para admins.
  foreach table_name in array array[
    'events', 'forms', 'province_catalog', 'commissions', 'workshops',
    'form_submissions', 'attendee_directory', 'commission_acts'
  ] loop
    execute format(
      'create policy "Admins delete %1$s" on public.%1$I for delete to authenticated using ((select private.is_admin()))',
      table_name
    );
  end loop;
end $$;

grant delete on public.form_submissions, public.attendee_directory to authenticated;

-- Storage de actas.
drop policy "Published act documents and administrator can read from private bucket" on storage.objects;
drop policy "Administrator uploads acts" on storage.objects;
drop policy "Administrator updates acts" on storage.objects;
drop policy "Administrator deletes acts" on storage.objects;

create policy "Staff and published act documents can be read"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'commission-acts'
    and ((select private.can_read()) or private.is_public_acta_path(name))
  );
create policy "Editors upload acts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'commission-acts' and (select private.can_edit()));
create policy "Editors update acts"
  on storage.objects for update to authenticated
  using (bucket_id = 'commission-acts' and (select private.can_edit()))
  with check (bucket_id = 'commission-acts' and (select private.can_edit()));
-- Reemplazar un acta deja el archivo anterior sin uso: los editores pueden
-- quitar archivos de este bucket para no acumular huérfanos.
create policy "Editors delete act files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'commission-acts' and (select private.can_edit()));

-- Publicar una versión de formulario es parte de la edición.
create or replace function public.publish_form_version(requested_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_form uuid;
begin
  if not private.can_edit() then
    raise exception 'No tenés permiso para publicar formularios.' using errcode = '42501';
  end if;

  select form_id into target_form
    from public.form_versions
    where id = requested_version and status = 'draft';
  if target_form is null then
    raise exception 'La versión no existe o ya fue publicada.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.form_questions where version_id = requested_version) then
    raise exception 'Agregá al menos una pregunta antes de publicar.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.form_questions q
    where q.version_id = requested_version
      and q.question_type in ('single_choice', 'multi_choice')
      and not exists (select 1 from public.form_question_options o where o.question_id = q.id)
  ) then
    raise exception 'Las preguntas de selección necesitan opciones.' using errcode = '22023';
  end if;

  update public.form_versions set status = 'archived'
    where form_id = target_form and status = 'published';
  update public.form_versions set status = 'published', published_at = now()
    where id = requested_version;
  update public.forms set status = 'published', updated_at = now()
    where id = target_form;
end;
$$;

-- ---------- Auditoría compartida por las tablas nuevas ----------

create or replace function private.touch_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

drop table public.admin_users;

comment on table public.staff_members is
  'Equipo del panel y su rol; altas por invitación de un admin.';
