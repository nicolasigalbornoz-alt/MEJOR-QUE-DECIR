-- Soporte para importar las respuestas y el padrón de la planilla anterior
-- (Google Sheets / Apps Script).
--
-- 1. Opción de necesidades que existió en la encuesta anterior y que tienen
--    respuestas históricas: "Mejoras en infraestructura y servicios".
-- 2. Asignación final de comisión y panel de cada respuesta (puede diferir
--    de lo elegido por cupos o por cambios en la acreditación).
-- 3. Marca de acreditación en el padrón.

insert into public.form_question_options (question_id, value, label, position)
select q.id, 'infraestructura', 'Mejoras en infraestructura y servicios',
  coalesce((select max(o.position) + 1 from public.form_question_options o where o.question_id = q.id), 0)
from public.form_questions q
join public.form_versions fv on fv.id = q.version_id
join public.forms f on f.id = fv.form_id
where f.slug = 'mejor-que-decir' and q.field_key = 'necesidades'
on conflict (question_id, value) do update set label = excluded.label;

create table public.submission_assignments (
  submission_id uuid primary key references public.form_submissions(id) on delete cascade,
  commission_id text references public.commissions(id) on delete restrict,
  workshop_id text references public.workshops(id) on delete restrict,
  updated_at timestamptz not null default now()
);

alter table public.attendee_directory
  add column accredited boolean not null default false;

alter table public.submission_assignments enable row level security;

revoke all on public.submission_assignments from anon, authenticated;
grant select, insert, update, delete on public.submission_assignments to authenticated;

create policy "Only administrator manages submission assignments"
  on public.submission_assignments for all to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

comment on table public.submission_assignments is
  'Asignación final de comisión y panel por respuesta; privada, solo administración.';
comment on column public.attendee_directory.accredited is
  'Acreditación en el encuentro; privada, no se expone en search_attendees.';
