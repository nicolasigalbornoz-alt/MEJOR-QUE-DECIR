-- Plataforma MEJOR QUE DECIR: eventos, formularios versionados, respuestas,
-- catálogos geográficos, comisiones, talleres y actas.

create extension if not exists unaccent with schema extensions;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 180),
  description text not null default '',
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 1 and 180),
  intro text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (form_id, version_number),
  unique (id, form_id)
);

create unique index form_versions_one_published_per_form
  on public.form_versions (form_id)
  where status = 'published';

create table public.form_questions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.form_versions(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-zA-Z][a-zA-Z0-9_]{0,63}$'),
  label text not null check (char_length(label) between 1 and 500),
  help_text text not null default '',
  question_type text not null check (question_type in (
    'text', 'textarea', 'single_choice', 'multi_choice', 'scale',
    'province', 'locality', 'participant_lookup'
  )),
  position integer not null check (position >= 0),
  required boolean not null default false,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  visible_when jsonb check (visible_when is null or jsonb_typeof(visible_when) = 'object'),
  unique (version_id, field_key),
  unique (version_id, position)
);

create table public.form_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.form_questions(id) on delete cascade,
  value text not null check (char_length(value) between 1 and 300),
  label text not null check (char_length(label) between 1 and 500),
  position integer not null check (position >= 0),
  unique (question_id, value),
  unique (question_id, position)
);

create table public.province_catalog (
  id text primary key check (id ~ '^[a-z0-9]+$'),
  name text not null unique,
  region text not null,
  map_point jsonb check (map_point is null or jsonb_typeof(map_point) = 'array')
);

create table public.commissions (
  id text primary key check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique,
  capacity integer not null default 70 check (capacity >= 0),
  position integer not null unique check (position >= 0),
  active boolean not null default true
);

create table public.workshops (
  id text primary key check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null unique,
  capacity integer not null default 75 check (capacity >= 0),
  position integer not null unique check (position >= 0),
  active boolean not null default true
);

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null,
  form_id uuid not null references public.forms(id) on delete restrict,
  event_id uuid references public.events(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 200),
  normalized_name text not null check (char_length(normalized_name) between 1 and 200),
  province_id text not null references public.province_catalog(id),
  locality text not null check (char_length(locality) between 1 and 200),
  answers jsonb not null check (
    jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 65536
  ),
  is_demo boolean not null default false,
  submitted_at timestamptz not null default now(),
  foreign key (form_version_id, form_id) references public.form_versions(id, form_id) on delete restrict
);

create unique index form_submissions_no_duplicate_real_name
  on public.form_submissions (form_id, normalized_name)
  where not is_demo;

create index form_submissions_report_idx
  on public.form_submissions (form_version_id, province_id, submitted_at)
  where not is_demo;

create table public.attendee_directory (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 200),
  normalized_name text not null check (char_length(normalized_name) between 1 and 200),
  province_id text references public.province_catalog(id),
  locality text not null default '' check (char_length(locality) <= 200),
  unique (event_id, normalized_name)
);

create index attendee_directory_name_idx on public.attendee_directory (event_id, normalized_name);

create table public.commission_acts (
  id uuid primary key default gen_random_uuid(),
  commission_id text not null unique references public.commissions(id) on delete restrict,
  summary text not null check (char_length(summary) between 1 and 2000),
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in (
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 8388608),
  document_public boolean not null default false,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.normalize_person_name(raw_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
    lower(extensions.unaccent(coalesce(raw_value, ''))),
    '[[:space:]]+', ' ', 'g'
  )::text;
$$;

revoke all on function private.normalize_person_name(text) from public, anon;
grant execute on function private.normalize_person_name(text) to authenticated;

create or replace function public.submit_form_response(
  requested_version uuid,
  response_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  form_version record;
  question record;
  answer_value jsonb;
  conditional_value jsonb;
  condition_field text;
  condition_array jsonb;
  answer_count integer;
  display_name text;
  normalized_name text;
  province_key text;
  locality_value text;
  new_submission_id uuid;
begin
  if response_answers is null or jsonb_typeof(response_answers) <> 'object'
     or octet_length(response_answers::text) > 65536 then
    raise exception 'La respuesta no tiene un formato válido.' using errcode = '22023';
  end if;

  select fv.id, fv.form_id, f.event_id, f.slug
    into form_version
    from public.form_versions fv
    join public.forms f on f.id = fv.form_id
    where fv.id = requested_version
      and fv.status = 'published'
      and f.status = 'published'
      and (f.event_id is null or exists (
        select 1 from public.events e where e.id = f.event_id and e.status = 'published'
      ));

  if not found then
    raise exception 'El formulario no está disponible.' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_object_keys(response_answers) submitted_key(field_key)
    where not exists (
      select 1 from public.form_questions q
      where q.version_id = requested_version and q.field_key = submitted_key.field_key
    )
  ) then
    raise exception 'La respuesta contiene campos que no pertenecen a este formulario.' using errcode = '22023';
  end if;

  for question in
    select q.field_key, q.question_type, q.required, q.config, q.visible_when
      from public.form_questions q
      where q.version_id = requested_version
      order by q.position
  loop
    answer_value := response_answers -> question.field_key;
    conditional_value := question.visible_when;

    if conditional_value is not null then
      condition_field := conditional_value ->> 'field';
      if conditional_value ? 'contains' then
        condition_array := response_answers -> condition_field;
        if jsonb_typeof(condition_array) <> 'array' or not exists (
          select 1 from jsonb_array_elements_text(condition_array) item(value)
          where item.value = conditional_value ->> 'contains'
        ) then
          continue;
        end if;
      elsif response_answers ->> condition_field is distinct from conditional_value ->> 'equals' then
        continue;
      end if;
    end if;

    if question.required and (
      answer_value is null or answer_value = 'null'::jsonb or
      (jsonb_typeof(answer_value) = 'string' and btrim(answer_value #>> '{}') = '') or
      (jsonb_typeof(answer_value) = 'array' and jsonb_array_length(answer_value) = 0)
    ) then
      raise exception 'Falta completar un campo obligatorio.' using errcode = '22023';
    end if;

    if answer_value is null or answer_value = 'null'::jsonb then
      continue;
    end if;

    if question.question_type in ('text', 'textarea', 'province', 'locality', 'participant_lookup') then
      if jsonb_typeof(answer_value) <> 'string' or char_length(answer_value #>> '{}') > 2000 then
        raise exception 'Un campo de texto no tiene un formato válido.' using errcode = '22023';
      end if;
    elsif question.question_type = 'single_choice' then
      if not exists (
        select 1 from public.form_question_options o
        join public.form_questions q on q.id = o.question_id
        where q.version_id = requested_version
          and q.field_key = question.field_key
          and o.value = answer_value #>> '{}'
      ) then
        raise exception 'Una opción elegida no pertenece al formulario.' using errcode = '22023';
      end if;
    elsif question.question_type = 'multi_choice' then
      if jsonb_typeof(answer_value) <> 'array' then
        raise exception 'Una selección múltiple no tiene un formato válido.' using errcode = '22023';
      end if;
      answer_count := jsonb_array_length(answer_value);
      if answer_count > coalesce((question.config ->> 'maxSelections')::integer, 20) then
        raise exception 'Se eligieron demasiadas opciones.' using errcode = '22023';
      end if;
      if (select count(distinct selected.value) from jsonb_array_elements_text(answer_value) selected(value)) <> answer_count then
        raise exception 'No repitas opciones dentro de una selección múltiple.' using errcode = '22023';
      end if;
      if exists (
        select 1
          from jsonb_array_elements_text(answer_value) selected(value)
          where not exists (
            select 1 from public.form_question_options o
            join public.form_questions q on q.id = o.question_id
            where q.version_id = requested_version
              and q.field_key = question.field_key
              and o.value = selected.value
          )
      ) then
        raise exception 'Una opción elegida no pertenece al formulario.' using errcode = '22023';
      end if;
    elsif question.question_type = 'scale' then
      if jsonb_typeof(answer_value) <> 'number'
        or (answer_value #>> '{}')::numeric < coalesce((question.config ->> 'min')::numeric, 0)
        or (answer_value #>> '{}')::numeric > coalesce((question.config ->> 'max')::numeric, 10)
        or (answer_value #>> '{}')::numeric <> trunc((answer_value #>> '{}')::numeric) then
        raise exception 'Una escala está fuera del rango permitido.' using errcode = '22023';
      end if;
    end if;
  end loop;

  display_name := btrim(response_answers ->> 'nombre');
  province_key := response_answers ->> 'provincia';
  locality_value := btrim(response_answers ->> 'localidad');
  normalized_name := private.normalize_person_name(display_name);

  if display_name is null or char_length(display_name) > 200
     or normalized_name = '' or locality_value is null
     or not exists (select 1 from public.province_catalog p where p.id = province_key) then
    raise exception 'Faltan datos territoriales o de identificación válidos.' using errcode = '22023';
  end if;

  begin
    insert into public.form_submissions (
      form_version_id, form_id, event_id, display_name, normalized_name,
      province_id, locality, answers
    ) values (
      form_version.id, form_version.form_id, form_version.event_id, display_name, normalized_name,
      province_key, locality_value, response_answers
    ) returning id into new_submission_id;
  exception when unique_violation then
    raise exception 'Ya existe una respuesta con ese nombre para este formulario.' using errcode = '23505';
  end;

  return new_submission_id;
end;
$$;

create or replace function public.search_attendees(
  requested_event uuid,
  query_text text
)
returns table (display_name text, province text, locality text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.display_name, p.name, a.locality
    from public.attendee_directory a
    left join public.province_catalog p on p.id = a.province_id
    where a.event_id = requested_event
      and char_length(btrim(query_text)) between 3 and 100
      and a.normalized_name like private.normalize_person_name(query_text) || '%'
    order by a.display_name
    limit 8;
$$;

create or replace function public.publish_form_version(requested_version uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_form uuid;
begin
  if not private.is_admin() then
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

create or replace function private.is_public_acta_path(object_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.commission_acts a
    where a.storage_path = object_path and a.document_public
  );
$$;

create or replace view public.published_commission_acts
with (security_barrier = true)
as
  select a.id, a.commission_id, c.name as commission, a.summary, a.uploaded_at,
    case when a.document_public then a.storage_path else null end as public_document_path
  from public.commission_acts a
  join public.commissions c on c.id = a.commission_id;

create or replace function public.get_public_survey_report(requested_form_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if requested_form_slug <> 'mejor-que-decir' then
    raise exception 'No hay un informe público para ese formulario.' using errcode = '42501';
  end if;

  with source as (
    select s.id, s.form_version_id, s.province_id, p.name as province_name, p.region,
      btrim(s.locality) as locality, s.answers, s.submitted_at
    from public.form_submissions s
    join public.form_versions fv on fv.id = s.form_version_id
    join public.forms f on f.id = fv.form_id
    join public.province_catalog p on p.id = s.province_id
    where f.slug = requested_form_slug and f.status = 'published' and not s.is_demo
  ),
  problem_mentions as (
    select s.province_id, s.answers ->> 'comision' as commission_id, coalesce(o.label, selected.value) as label
    from source s
    cross join lateral jsonb_array_elements_text(coalesce(s.answers -> 'problemas', '[]'::jsonb)) selected(value)
    left join public.form_questions q on q.version_id = s.form_version_id and q.field_key = 'problemas'
    left join public.form_question_options o on o.question_id = q.id and o.value = selected.value
  ),
  need_mentions as (
    select s.province_id, s.answers ->> 'comision' as commission_id, coalesce(o.label, selected.value) as label
    from source s
    cross join lateral jsonb_array_elements_text(coalesce(s.answers -> 'necesidades', '[]'::jsonb)) selected(value)
    left join public.form_questions q on q.version_id = s.form_version_id and q.field_key = 'necesidades'
    left join public.form_question_options o on o.question_id = q.id and o.value = selected.value
  ),
  province_counts as (
    select province_id, max(province_name) as province_name, max(region) as region,
      count(*)::integer as count,
      coalesce(sum((answers ->> 'situacionEscala')::numeric), 0)::numeric as situation_sum,
      count(*) filter (where answers ->> 'situacionEscala' ~ '^[1-5]$')::integer as situation_n,
      coalesce(sum((answers ->> 'visionEscala')::numeric), 0)::numeric as vision_sum,
      count(*) filter (where answers ->> 'visionEscala' ~ '^-?[0-2]$')::integer as vision_n
    from source group by province_id
  ),
  national_problems as (
    select label, count(*)::integer as count from problem_mentions group by label
  ),
  national_needs as (
    select label, count(*)::integer as count from need_mentions group by label
  ),
  province_report as (
    select pc.province_id,
      jsonb_build_object(
        'id', pc.province_id, 'name', pc.province_name, 'region', pc.region,
        'count', pc.count, 'situacionSum', pc.situation_sum, 'situacionN', pc.situation_n,
        'visionSum', pc.vision_sum, 'visionN', pc.vision_n,
        'problemas', coalesce((
          select jsonb_object_agg(t.label, t.count) from (
            select pm.label, count(*)::integer as count from problem_mentions pm
            where pm.province_id = pc.province_id group by pm.label
          ) t
        ), '{}'::jsonb),
        'necesidades', coalesce((
          select jsonb_object_agg(t.label, t.count) from (
            select nm.label, count(*)::integer as count from need_mentions nm
            where nm.province_id = pc.province_id group by nm.label
          ) t
        ), '{}'::jsonb),
        'localidades', coalesce((
          select jsonb_object_agg(t.locality, t.count) from (
            select min(s.locality) as locality, count(*)::integer as count
            from source s where s.province_id = pc.province_id
            group by lower(extensions.unaccent(s.locality))
          ) t
        ), '{}'::jsonb),
        'quotes', coalesce((
          select jsonb_agg(jsonb_build_object('text', t.quote, 'localidad', t.locality, 'provincia', pc.province_name))
          from (
            select coalesce(nullif(btrim(s.answers ->> 'problematicaTerritorio'), ''),
                            nullif(btrim(s.answers ->> 'situacionTexto'), ''),
                            nullif(btrim(s.answers ->> 'visionFrase'), '')) as quote,
                   s.locality
            from source s where s.province_id = pc.province_id
            and coalesce(nullif(btrim(s.answers ->> 'problematicaTerritorio'), ''),
                         nullif(btrim(s.answers ->> 'situacionTexto'), ''),
                         nullif(btrim(s.answers ->> 'visionFrase'), '')) is not null
            order by s.submitted_at limit 8
          ) t
        ), '[]'::jsonb)
      ) as value
    from province_counts pc
  ),
  commission_report as (
    select c.id,
      jsonb_build_object(
        'name', c.name, 'count', count(s.id)::integer,
        'problemas', coalesce((
          select jsonb_object_agg(t.label, t.count) from (
            select pm.label, count(*)::integer as count from problem_mentions pm
            where pm.commission_id = c.id group by pm.label
          ) t
        ), '{}'::jsonb),
        'necesidades', coalesce((
          select jsonb_object_agg(t.label, t.count) from (
            select nm.label, count(*)::integer as count from need_mentions nm
            where nm.commission_id = c.id group by nm.label
          ) t
        ), '{}'::jsonb),
        'situacionSum', coalesce(sum((s.answers ->> 'situacionEscala')::numeric), 0),
        'situacionN', count(*) filter (where s.answers ->> 'situacionEscala' ~ '^[1-5]$')::integer,
        'visionSum', coalesce(sum((s.answers ->> 'visionEscala')::numeric), 0),
        'visionN', count(*) filter (where s.answers ->> 'visionEscala' ~ '^-?[0-2]$')::integer,
        'quotes', coalesce((
          select jsonb_agg(jsonb_build_object('text', t.quote, 'localidad', t.locality, 'provincia', t.province_name))
          from (
            select coalesce(nullif(btrim(s2.answers ->> 'comisionComentario'), ''),
                            nullif(btrim(s2.answers ->> 'situacionTexto'), ''),
                            nullif(btrim(s2.answers ->> 'visionFrase'), '')) as quote,
                   s2.locality, s2.province_name
            from source s2 where s2.answers ->> 'comision' = c.id
            and coalesce(nullif(btrim(s2.answers ->> 'comisionComentario'), ''),
                         nullif(btrim(s2.answers ->> 'situacionTexto'), ''),
                         nullif(btrim(s2.answers ->> 'visionFrase'), '')) is not null
            order by s2.submitted_at limit 6
          ) t
        ), '[]'::jsonb)
      ) as value
    from public.commissions c
    left join source s on s.answers ->> 'comision' = c.id
    where c.active
    group by c.id, c.name, c.position
  ),
  aggregate_counts as (
    select
      (select count(*)::integer from source) as total_responses,
      (select count(distinct province_id)::integer from source) as total_provinces,
      (select count(distinct province_id || ':' || lower(extensions.unaccent(locality)))::integer from source) as total_localities,
      coalesce((select jsonb_object_agg(label, count) from national_problems), '{}'::jsonb) as problems,
      coalesce((select jsonb_object_agg(label, count) from national_needs), '{}'::jsonb) as needs,
      coalesce((select jsonb_object_agg(value, count) from (
        select answers ->> 'participa' as value, count(*)::integer as count
        from source where nullif(answers ->> 'participa', '') is not null group by answers ->> 'participa'
      ) t), '{}'::jsonb) as participates,
      coalesce((select jsonb_object_agg(value, count) from (
        select answers ->> 'visionEscala' as value, count(*)::integer as count
        from source where answers ->> 'visionEscala' ~ '^-?[0-2]$' group by answers ->> 'visionEscala'
      ) t), '{}'::jsonb) as visions,
      coalesce((select jsonb_object_agg(value, count) from (
        select answers ->> 'situacionEscala' as value, count(*)::integer as count
        from source where answers ->> 'situacionEscala' ~ '^[1-5]$' group by answers ->> 'situacionEscala'
      ) t), '{}'::jsonb) as situations
  )
  select jsonb_build_object(
    'isDemo', false,
    'empty', ac.total_responses = 0,
    'totalResponses', ac.total_responses,
    'totalProvinces', ac.total_provinces,
    'totalLocalidades', ac.total_localities,
    'byProvince', coalesce((select jsonb_object_agg(province_id, value) from province_report), '{}'::jsonb),
    'byCommission', coalesce((select jsonb_object_agg(id, value) from commission_report), '{}'::jsonb),
    'nacProblemas', ac.problems,
    'nacNecesidades', ac.needs,
    'nacParticipa', ac.participates,
    'nacVision', ac.visions,
    'nacSituacion', ac.situations,
    'maxCount', greatest(1, coalesce((select max(count) from province_counts), 1))
  ) into result
  from aggregate_counts ac;

  return result;
end;
$$;

-- Tablas privadas por defecto; solo catálogo, eventos publicados y vistas
-- explícitamente públicas son consultables sin iniciar sesión.
alter table public.events enable row level security;
alter table public.forms enable row level security;
alter table public.form_versions enable row level security;
alter table public.form_questions enable row level security;
alter table public.form_question_options enable row level security;
alter table public.province_catalog enable row level security;
alter table public.commissions enable row level security;
alter table public.workshops enable row level security;
alter table public.form_submissions enable row level security;
alter table public.attendee_directory enable row level security;
alter table public.commission_acts enable row level security;

revoke all on public.events, public.forms, public.form_versions, public.form_questions,
  public.form_question_options, public.province_catalog, public.commissions,
  public.workshops, public.form_submissions, public.attendee_directory,
  public.commission_acts from anon, authenticated;

grant select on public.events, public.forms, public.form_versions,
  public.form_questions, public.form_question_options,
  public.province_catalog, public.commissions, public.workshops to anon, authenticated;
grant select, insert, update, delete on public.events, public.forms, public.form_versions,
  public.form_questions, public.form_question_options, public.commissions,
  public.workshops, public.commission_acts to authenticated;
grant select on public.form_submissions, public.attendee_directory, public.commission_acts to authenticated;
grant select on public.published_commission_acts to anon, authenticated;

create policy "Published events are public"
  on public.events for select to anon, authenticated using (status = 'published' or (select private.is_admin()));
create policy "Only administrator manages events"
  on public.events for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Published forms are public"
  on public.forms for select to anon, authenticated
  using (
    (status = 'published' and (event_id is null or exists (
      select 1 from public.events e where e.id = event_id and e.status = 'published'
    ))) or (select private.is_admin())
  );
create policy "Only administrator manages forms"
  on public.forms for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Published versions and administrator can read"
  on public.form_versions for select to anon, authenticated
  using (
    status = 'published' and exists (
      select 1 from public.forms f
      where f.id = form_id and f.status = 'published'
        and (f.event_id is null or exists (select 1 from public.events e where e.id = f.event_id and e.status = 'published'))
    ) or (select private.is_admin())
  );
create policy "Only administrator manages form versions"
  on public.form_versions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Published questions and administrator can read"
  on public.form_questions for select to anon, authenticated
  using (
    exists (
      select 1 from public.form_versions fv join public.forms f on f.id = fv.form_id
      where fv.id = version_id and fv.status = 'published' and f.status = 'published'
        and (f.event_id is null or exists (select 1 from public.events e where e.id = f.event_id and e.status = 'published'))
    ) or (select private.is_admin())
  );
create policy "Only administrator manages form questions"
  on public.form_questions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Published question options and administrator can read"
  on public.form_question_options for select to anon, authenticated
  using (
    exists (
      select 1 from public.form_questions q
      join public.form_versions fv on fv.id = q.version_id
      join public.forms f on f.id = fv.form_id
      where q.id = question_id and fv.status = 'published' and f.status = 'published'
        and (f.event_id is null or exists (select 1 from public.events e where e.id = f.event_id and e.status = 'published'))
    ) or (select private.is_admin())
  );
create policy "Only administrator manages question options"
  on public.form_question_options for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Province catalog is public" on public.province_catalog
  for select to anon, authenticated using (true);
create policy "Only administrator manages province catalog" on public.province_catalog
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Commission catalog is public" on public.commissions
  for select to anon, authenticated using (active or (select private.is_admin()));
create policy "Only administrator manages commissions" on public.commissions
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Workshop catalog is public" on public.workshops
  for select to anon, authenticated using (active or (select private.is_admin()));
create policy "Only administrator manages workshops" on public.workshops
  for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Only administrator reads submissions"
  on public.form_submissions for select to authenticated using ((select private.is_admin()));
create policy "Only administrator manages submissions"
  on public.form_submissions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Only administrator reads attendee directory"
  on public.attendee_directory for select to authenticated using ((select private.is_admin()));
create policy "Only administrator manages attendee directory"
  on public.attendee_directory for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Only administrator manages acts"
  on public.commission_acts for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy "Published act documents and administrator can read from private bucket"
  on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'commission-acts'
    and ((select private.is_admin()) or private.is_public_acta_path(name))
  );
create policy "Administrator uploads acts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'commission-acts' and (select private.is_admin()));
create policy "Administrator updates acts"
  on storage.objects for update to authenticated
  using (bucket_id = 'commission-acts' and (select private.is_admin()))
  with check (bucket_id = 'commission-acts' and (select private.is_admin()));
create policy "Administrator deletes acts"
  on storage.objects for delete to authenticated
  using (bucket_id = 'commission-acts' and (select private.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'commission-acts', 'commission-acts', false, 8388608,
  array['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke all on function public.submit_form_response(uuid, jsonb) from public;
grant execute on function public.submit_form_response(uuid, jsonb) to anon, authenticated;

revoke all on function public.search_attendees(uuid, text) from public;
grant execute on function public.search_attendees(uuid, text) to anon, authenticated;

revoke all on function public.publish_form_version(uuid) from public, anon;
grant execute on function public.publish_form_version(uuid) to authenticated;

revoke all on function public.get_public_survey_report(text) from public;
grant execute on function public.get_public_survey_report(text) to anon, authenticated;

revoke all on function private.is_public_acta_path(text) from public, authenticated;
grant usage on schema private to anon;
grant execute on function private.is_public_acta_path(text) to anon, authenticated;
grant execute on function private.is_admin() to anon;

comment on table public.form_submissions is
  'Respuestas privadas; la capa pública consume únicamente el agregado de get_public_survey_report.';
comment on table public.attendee_directory is
  'Padrón mínimo privado para autocompletar; no almacenar otros campos personales.';
comment on table public.commission_acts is
  'Resumen público; documento Word privado salvo habilitación individual document_public.';
