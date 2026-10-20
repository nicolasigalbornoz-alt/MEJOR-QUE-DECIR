-- Etiquetas editables por categoría y base de compañeros.

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'responsabilidad', 'tipo_contacto', 'publico', 'actividad', 'tema_formacion'
  )),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  color text not null default '#29a6dd' check (color ~ '^#[0-9a-fA-F]{6}$'),
  position integer not null default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index tags_unique_name_per_category on public.tags (category, lower(btrim(name)));

-- Comprueba que una columna que apunta a tags use una categoría permitida.
-- Uso: execute function private.check_tag_category('columna', 'categoria', ...).
create or replace function private.check_tag_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  tag_value uuid;
  tag_category text;
begin
  tag_value := (to_jsonb(new) ->> tg_argv[0])::uuid;
  if tag_value is null then
    return new;
  end if;
  select category into tag_category from public.tags where id = tag_value;
  if tag_category is null or not (tag_category = any (tg_argv[1:])) then
    raise exception 'La etiqueta no corresponde a esta sección.' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- created_by/updated_by salen siempre de la sesión, no de lo que mande el
-- cliente (desde el SQL Editor quedan vacíos).
create or replace function private.touch_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create table public.militants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(btrim(full_name)) between 1 and 200),
  normalized_name text generated always as (private.normalize_person_name(full_name)) stored,
  province_id text references public.province_catalog(id),
  locality text not null default '' check (char_length(locality) <= 200),
  phone text not null default '' check (char_length(phone) <= 60),
  email text not null default '' check (char_length(email) <= 254),
  notes text not null default '' check (char_length(notes) <= 4000),
  active boolean not null default true,
  source text not null default 'manual' check (source in ('manual', 'padron-2026')),
  -- Texto normalizado (sin acentos ni mayúsculas) para la búsqueda.
  search_text text generated always as (
    private.normalize_person_name(full_name || ' ' || locality || ' ' || email)
  ) stored,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index militants_name_idx on public.militants (normalized_name);
create index militants_province_idx on public.militants (province_id);

create table public.militant_roles (
  id uuid primary key default gen_random_uuid(),
  militant_id uuid not null references public.militants(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  detail text not null default '' check (char_length(detail) <= 200)
);

create unique index militant_roles_unique on public.militant_roles (militant_id, tag_id, lower(btrim(detail)));
create index militant_roles_tag_idx on public.militant_roles (tag_id);

create trigger militant_roles_tag_category
  before insert or update on public.militant_roles
  for each row execute function private.check_tag_category('tag_id', 'responsabilidad');

create trigger militants_audit
  before insert or update on public.militants
  for each row execute function private.touch_audit_fields();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger tags_updated_at
  before update on public.tags
  for each row execute function private.touch_updated_at();

-- ---------- Permisos ----------

alter table public.tags enable row level security;
alter table public.militants enable row level security;
alter table public.militant_roles enable row level security;

revoke all on public.tags, public.militants, public.militant_roles from anon, authenticated;
grant select, insert, update, delete on public.tags, public.militants, public.militant_roles to authenticated;

create policy "Staff reads tags" on public.tags for select to authenticated using ((select private.can_read()));
create policy "Editors insert tags" on public.tags for insert to authenticated with check ((select private.can_edit()));
create policy "Editors update tags" on public.tags for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Admins delete tags" on public.tags for delete to authenticated using ((select private.is_admin()));

create policy "Staff reads militants" on public.militants for select to authenticated using ((select private.can_read()));
create policy "Editors insert militants" on public.militants for insert to authenticated with check ((select private.can_edit()));
create policy "Editors update militants" on public.militants for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Admins delete militants" on public.militants for delete to authenticated using ((select private.is_admin()));

-- Las responsabilidades son parte de la ficha: los editores las agregan y quitan.
create policy "Staff reads militant roles" on public.militant_roles for select to authenticated using ((select private.can_read()));
create policy "Editors manage militant roles" on public.militant_roles for all to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));

-- ---------- Etiquetas iniciales ----------

insert into public.tags (category, name, color, position) values
  ('responsabilidad', 'Militante', '#29a6dd', 0),
  ('responsabilidad', 'Coordinador/a de comisión', '#04537a', 1),
  ('responsabilidad', 'Responsable de localidad', '#0ca30c', 2),
  ('responsabilidad', 'Responsable provincial', '#ec835a', 3),
  ('publico', 'Secundarios', '#29a6dd', 0),
  ('publico', 'Universitarios', '#04537a', 1),
  ('publico', 'Barrios', '#0ca30c', 2),
  ('publico', 'Militancia', '#ec835a', 3)
on conflict do nothing;

comment on table public.militants is
  'Base interna de compañeros; datos personales visibles solo para el equipo del panel.';
