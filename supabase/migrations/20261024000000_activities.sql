-- Insumos: actividades replicables con procedimiento, tags, personas y adjuntos.

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 6000),
  purpose text not null default '' check (char_length(purpose) <= 4000),
  procedure text not null default '' check (char_length(procedure) <= 20000),
  -- Texto normalizado (sin acentos ni mayúsculas) para la búsqueda.
  search_text text generated always as (
    private.normalize_person_name(title || ' ' || description || ' ' || purpose)
  ) stored,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activities_title_idx on public.activities (lower(title));

create table public.activity_tags (
  activity_id uuid not null references public.activities(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  primary key (activity_id, tag_id)
);

create index activity_tags_tag_idx on public.activity_tags (tag_id);

-- Quienes la hicieron: un compañero o un contacto, con una nota opcional.
create table public.activity_people (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  militant_id uuid references public.militants(id) on delete restrict,
  contact_id uuid references public.contacts(id) on delete restrict,
  note text not null default '' check (char_length(note) <= 200),
  check (num_nonnulls(militant_id, contact_id) = 1)
);

create unique index activity_people_unique on public.activity_people (activity_id, coalesce(militant_id, contact_id));

create table public.activity_attachments (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  kind text not null check (kind in ('file', 'link')),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  storage_path text unique check (char_length(storage_path) <= 500),
  mime_type text,
  size_bytes bigint check (size_bytes between 1 and 20971520),
  url text check (url ~ '^https?://' and char_length(url) <= 2000),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  check (
    (kind = 'file' and storage_path is not null and mime_type is not null and size_bytes is not null and url is null)
    or (kind = 'link' and url is not null and storage_path is null)
  )
);

create index activity_attachments_activity_idx on public.activity_attachments (activity_id, position);

create trigger activity_tags_category
  before insert or update on public.activity_tags
  for each row execute function private.check_tag_category('tag_id', 'publico', 'actividad');

create trigger activities_audit
  before insert or update on public.activities
  for each row execute function private.touch_audit_fields();

alter table public.activities enable row level security;
alter table public.activity_tags enable row level security;
alter table public.activity_people enable row level security;
alter table public.activity_attachments enable row level security;

revoke all on public.activities, public.activity_tags, public.activity_people, public.activity_attachments from anon, authenticated;
grant select, insert, update, delete on public.activities, public.activity_tags, public.activity_people, public.activity_attachments to authenticated;

create policy "Staff reads activities" on public.activities for select to authenticated using ((select private.can_read()));
create policy "Editors insert activities" on public.activities for insert to authenticated with check ((select private.can_edit()));
create policy "Editors update activities" on public.activities for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Admins delete activities" on public.activities for delete to authenticated using ((select private.is_admin()));

-- Tags, personas y adjuntos son parte de la ficha: los editores los agregan y quitan.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['activity_tags', 'activity_people', 'activity_attachments'] loop
    execute format(
      'create policy "Staff reads %1$s" on public.%1$I for select to authenticated using ((select private.can_read()))',
      table_name
    );
    execute format(
      'create policy "Editors manage %1$s" on public.%1$I for all to authenticated using ((select private.can_edit())) with check ((select private.can_edit()))',
      table_name
    );
  end loop;
end $$;

-- ---------- Storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activity-files', 'activity-files', false, 20971520,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Staff reads activity files"
  on storage.objects for select to authenticated
  using (bucket_id = 'activity-files' and (select private.can_read()));
create policy "Editors upload activity files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'activity-files' and (select private.can_edit()));
-- Quitar un adjunto es parte de editar la actividad: los editores pueden
-- borrar el archivo para no dejar huérfanos.
create policy "Editors delete activity files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'activity-files' and (select private.can_edit()));

insert into public.tags (category, name, color, position) values
  ('actividad', 'Formación', '#04537a', 0),
  ('actividad', 'Debate', '#29a6dd', 1),
  ('actividad', 'Territorio', '#0ca30c', 2),
  ('actividad', 'Cultura', '#ec835a', 3)
on conflict do nothing;

comment on table public.activities is
  'Insumos internos: actividades replicables con procedimiento y adjuntos privados.';
