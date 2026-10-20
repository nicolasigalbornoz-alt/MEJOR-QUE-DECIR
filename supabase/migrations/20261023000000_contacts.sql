-- Contactos de dirigentes e instituciones y compañeros que los conocen.

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  type_tag_id uuid references public.tags(id) on delete restrict,
  description text not null default '' check (char_length(description) <= 4000),
  phone text not null default '' check (char_length(phone) <= 60),
  email text not null default '' check (char_length(email) <= 254),
  province_id text references public.province_catalog(id),
  locality text not null default '' check (char_length(locality) <= 200),
  notes text not null default '' check (char_length(notes) <= 4000),
  -- Texto normalizado (sin acentos ni mayúsculas) para la búsqueda.
  search_text text generated always as (
    private.normalize_person_name(name || ' ' || description || ' ' || locality)
  ) stored,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contacts_name_idx on public.contacts (lower(name));
create index contacts_type_idx on public.contacts (type_tag_id);

create table public.contact_referents (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  -- restrict: no se borra un compañero que es referente; se lo marca inactivo.
  militant_id uuid not null references public.militants(id) on delete restrict,
  note text not null default '' check (char_length(note) <= 200),
  primary key (contact_id, militant_id)
);

create index contact_referents_militant_idx on public.contact_referents (militant_id);

create trigger contacts_type_category
  before insert or update on public.contacts
  for each row execute function private.check_tag_category('type_tag_id', 'tipo_contacto');

create trigger contacts_audit
  before insert or update on public.contacts
  for each row execute function private.touch_audit_fields();

alter table public.contacts enable row level security;
alter table public.contact_referents enable row level security;

revoke all on public.contacts, public.contact_referents from anon, authenticated;
grant select, insert, update, delete on public.contacts, public.contact_referents to authenticated;

create policy "Staff reads contacts" on public.contacts for select to authenticated using ((select private.can_read()));
create policy "Editors insert contacts" on public.contacts for insert to authenticated with check ((select private.can_edit()));
create policy "Editors update contacts" on public.contacts for update to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));
create policy "Admins delete contacts" on public.contacts for delete to authenticated using ((select private.is_admin()));

create policy "Staff reads contact referents" on public.contact_referents for select to authenticated using ((select private.can_read()));
create policy "Editors manage contact referents" on public.contact_referents for all to authenticated
  using ((select private.can_edit())) with check ((select private.can_edit()));

insert into public.tags (category, name, color, position) values
  ('tipo_contacto', 'Dirigente', '#04537a', 0),
  ('tipo_contacto', 'Institución', '#29a6dd', 1),
  ('tipo_contacto', 'Organización social', '#0ca30c', 2),
  ('tipo_contacto', 'Funcionario/a', '#ec835a', 3)
on conflict do nothing;

comment on table public.contacts is
  'Contactos internos; el referente es el camino preferido para llegar a cada uno.';
