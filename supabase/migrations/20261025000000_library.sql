-- Formación: biblioteca interna de libros y PDFs (archivo subido o link).

create table public.library_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 250),
  author text not null default '' check (char_length(author) <= 200),
  year integer check (year between 1500 and 2100),
  description text not null default '' check (char_length(description) <= 4000),
  storage_path text unique check (char_length(storage_path) <= 500),
  mime_type text,
  size_bytes bigint check (size_bytes between 1 and 52428800),
  external_url text check (external_url ~ '^https?://' and char_length(external_url) <= 2000),
  -- Texto normalizado (sin acentos ni mayúsculas) para la búsqueda.
  search_text text generated always as (
    private.normalize_person_name(title || ' ' || author || ' ' || description)
  ) stored,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (storage_path is not null and mime_type is not null and size_bytes is not null and external_url is null)
    or (external_url is not null and storage_path is null and mime_type is null and size_bytes is null)
  )
);

create table public.library_item_tags (
  item_id uuid not null references public.library_items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete restrict,
  primary key (item_id, tag_id)
);

create index library_item_tags_tag_idx on public.library_item_tags (tag_id);

create trigger library_item_tags_category
  before insert or update on public.library_item_tags
  for each row execute function private.check_tag_category('tag_id', 'tema_formacion');

create trigger library_items_audit
  before insert or update on public.library_items
  for each row execute function private.touch_audit_fields();

alter table public.library_items enable row level security;
alter table public.library_item_tags enable row level security;

revoke all on public.library_items, public.library_item_tags from anon, authenticated;
grant select, insert, update, delete on public.library_items, public.library_item_tags to authenticated;

create policy "Staff reads library" on public.library_items for select to authenticated using ((select private.can_read()));
create policy "Editors insert library" on public.library_items for insert to authenticated with check ((select private.can_edit()));
create policy "Editors update library" on public.library_items for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Admins delete library" on public.library_items for delete to authenticated using ((select private.is_admin()));

create policy "Staff reads library tags" on public.library_item_tags for select to authenticated using ((select private.can_read()));
create policy "Editors manage library tags" on public.library_item_tags for all to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));

-- ---------- Storage ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('library', 'library', false, 52428800, array['application/pdf', 'application/epub+zip'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Staff reads library files"
  on storage.objects for select to authenticated
  using (bucket_id = 'library' and (select private.can_read()));
create policy "Editors upload library files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'library' and (select private.can_edit()));
-- Reemplazar el archivo de un ítem es parte de editarlo.
create policy "Editors delete library files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'library' and (select private.can_edit()));

insert into public.tags (category, name, color, position) values
  ('tema_formacion', 'Doctrina', '#04537a', 0),
  ('tema_formacion', 'Historia', '#ec835a', 1),
  ('tema_formacion', 'Economía', '#0ca30c', 2),
  ('tema_formacion', 'Política', '#29a6dd', 3)
on conflict do nothing;

comment on table public.library_items is
  'Biblioteca interna de formación; archivos privados, descargables solo por el equipo.';
