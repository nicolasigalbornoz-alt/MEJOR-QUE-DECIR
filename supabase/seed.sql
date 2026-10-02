-- Semillas funcionales (sin respuestas reales ni datos del padrón).
-- Las respuestas sintéticas se muestran desde el fixture CSV y se importan
-- a la base solo mediante el comando explícito de seed de demostración.

insert into public.events (id, slug, title, description, starts_at, status)
values (
  '00000000-0000-4000-8000-000000000001',
  'encuentro-nacional-jovenes-fr-2026',
  'Encuentro Nacional de Jóvenes FR',
  'Encuentro federal de escucha de Jóvenes FR.',
  '2026-09-19T00:00:00-03:00',
  'published'
)
on conflict (slug) do update set
  title = excluded.title,
  description = excluded.description,
  starts_at = excluded.starts_at,
  status = excluded.status;

insert into public.province_catalog (id, name, region, map_point) values
  ('jujuy', 'Jujuy', 'NOA', null),
  ('salta', 'Salta', 'NOA', null),
  ('formosa', 'Formosa', 'NEA', null),
  ('catamarca', 'Catamarca', 'NOA', null),
  ('tucuman', 'Tucumán', 'NOA', null),
  ('santiago', 'Santiago del Estero', 'NOA', null),
  ('chaco', 'Chaco', 'NEA', null),
  ('misiones', 'Misiones', 'NEA', null),
  ('rioja', 'La Rioja', 'Cuyo', null),
  ('corrientes', 'Corrientes', 'NEA', null),
  ('sanjuan', 'San Juan', 'Cuyo', null),
  ('cordoba', 'Córdoba', 'Centro', null),
  ('santafe', 'Santa Fe', 'Centro', null),
  ('entrerios', 'Entre Ríos', 'Centro', null),
  ('mendoza', 'Mendoza', 'Cuyo', null),
  ('sanluis', 'San Luis', 'Cuyo', null),
  ('pampa', 'La Pampa', 'Centro', null),
  ('caba', 'CABA', 'Centro', '[-34.6144420654301, -58.4458763250916]'::jsonb),
  ('buenosaires', 'Buenos Aires', 'Centro', null),
  ('neuquen', 'Neuquén', 'Patagonia', null),
  ('rionegro', 'Río Negro', 'Patagonia', null),
  ('chubut', 'Chubut', 'Patagonia', null),
  ('santacruz', 'Santa Cruz', 'Patagonia', null),
  ('tierradelfuego', 'Tierra del Fuego', 'Patagonia', null)
on conflict (id) do update set name = excluded.name, region = excluded.region, map_point = excluded.map_point;

insert into public.commissions (id, name, capacity, position) values
  ('trabajo-situacion-economica', 'Trabajo y situación económica', 70, 0),
  ('modelo-desarrollo-produccion-federalismo', 'Modelo de desarrollo, producción y federalismo', 70, 1),
  ('soberania-tierra-defensa', 'Soberanía, tierra y defensa', 70, 2),
  ('inteligencia-artificial-plataformas-poder', 'Inteligencia artificial, plataformas y poder: una mirada desde el Sur Global', 70, 3),
  ('seguridad', 'Seguridad', 70, 4),
  ('educacion', 'Educación', 70, 5),
  ('salud-mental', 'Salud mental', 70, 6),
  ('vivienda-habitat-urbanismo', 'Vivienda, hábitat y urbanismo', 70, 7),
  ('militancia-siglo-xxi', 'Militancia en el siglo XXI', 70, 8)
on conflict (id) do update set name = excluded.name, capacity = excluded.capacity, position = excluded.position, active = true;

insert into public.workshops (id, name, capacity, position) values
  ('argentina-bicontinental', 'Pensar en la Argentina Bicontinental: Malvinas, Antártida y Atlántico Sur', 75, 0),
  ('gestion-municipal', 'Gestión Municipal', 75, 1),
  ('politica-legislativa', 'Política legislativa', 75, 2),
  ('comunicacion-politica-redes', 'Comunicación política y redes', 75, 3),
  ('historia-peronista-vol-i', 'Historia del movimiento peronista (Vol I: gobierno de Perón y resistencia peronista)', 75, 4),
  ('historia-peronista-vol-ii', 'Historia del movimiento peronista (Vol II: de 1970 a la actualidad)', 75, 5),
  ('seguridad', 'Seguridad', 75, 6),
  ('economia', 'Economía', 75, 7)
on conflict (id) do update set name = excluded.name, capacity = excluded.capacity, position = excluded.position, active = true;

insert into public.forms (id, event_id, slug, title, intro, status)
values (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'mejor-que-decir',
  'MEJOR QUE DECIR',
  'Contanos cómo se ve la realidad desde donde estás. Tu respuesta se suma al mapa federal y al documento de síntesis.',
  'published'
)
on conflict (slug) do update set
  event_id = excluded.event_id,
  title = excluded.title,
  intro = excluded.intro,
  status = excluded.status;

insert into public.form_versions (id, form_id, version_number, status, published_at)
values (
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000002',
  1,
  'published',
  now()
)
on conflict (form_id, version_number) do update set status = excluded.status;

insert into public.form_questions
  (version_id, field_key, label, help_text, question_type, position, required, config, visible_when)
values
  ('00000000-0000-4000-8000-000000000003', 'nombre', 'Nombre y apellido', 'Usamos el nombre para reconocerte del padrón; no se publica en el mapa ni en la síntesis.', 'participant_lookup', 0, true, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'provincia', '¿De qué provincia sos?', '', 'province', 1, true, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'localidad', 'Localidad, ciudad o barrio', '', 'locality', 2, true, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'participa', '¿Participás en algún espacio político o de militancia?', '', 'single_choice', 3, true, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'agrupacion', '¿Cómo se llama tu espacio o agrupación?', '', 'text', 4, true, '{}'::jsonb, '{"field":"participa","equals":"Sí"}'::jsonb),
  ('00000000-0000-4000-8000-000000000003', 'situacionEscala', '¿Cómo calificarías la situación general de tu distrito hoy?', '', 'scale', 5, true, '{"min":1,"max":5,"minLabel":"Muy mala","maxLabel":"Muy buena"}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'situacionTexto', 'Contanos brevemente la situación de tu distrito', '', 'textarea', 6, true, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'problematicaTerritorio', 'Una problemática específica de tu territorio', 'Opcional.', 'textarea', 7, false, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'problemas', '¿Cuáles son los principales problemas de la juventud en tu lugar?', 'Elegí hasta 3.', 'multi_choice', 8, true, '{"maxSelections":3}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'problemaOtro', 'Contanos cuál otro problema', '', 'text', 9, false, '{}'::jsonb, '{"field":"problemas","contains":"otro"}'::jsonb),
  ('00000000-0000-4000-8000-000000000003', 'necesidades', '¿Qué necesitan los y las jóvenes de tu distrito para desarrollarse?', 'Elegí hasta 3.', 'multi_choice', 10, true, '{"maxSelections":3}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'comision', 'Comisión de interés', 'Elegí una.', 'single_choice', 11, true, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'comisionComentario', '¿Qué te gustaría que se trabaje en esa comisión?', 'Opcional.', 'textarea', 12, false, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'taller', 'Panel de interés', 'Elegí uno.', 'single_choice', 13, true, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'tallerComentario', '¿Qué esperás de ese panel?', 'Opcional.', 'textarea', 14, false, '{}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'visionEscala', '¿Qué tan optimista sos sobre el futuro del país?', '', 'scale', 15, true, '{"min":-2,"max":2,"minLabel":"Muy pesimista","maxLabel":"Muy optimista"}'::jsonb, null),
  ('00000000-0000-4000-8000-000000000003', 'visionFrase', '¿Qué país te gustaría construir?', 'En una frase (opcional).', 'text', 16, false, '{}'::jsonb, null)
on conflict (version_id, field_key) do update set
  label = excluded.label,
  help_text = excluded.help_text,
  question_type = excluded.question_type,
  position = excluded.position,
  required = excluded.required,
  config = excluded.config,
  visible_when = excluded.visible_when;

insert into public.form_question_options (question_id, value, label, position)
select q.id, o.value, o.label, o.position
from public.form_questions q
join (values
  ('participa', 'Sí', 'Sí', 0),
  ('participa', 'No', 'No', 1),
  ('participa', 'Todavía no, pero me gustaría', 'Todavía no, pero me gustaría', 2),
  ('problemas', 'empleo', 'Falta de empleo / trabajo precario', 0),
  ('problemas', 'educacion', 'Falta de oportunidades educativas', 1),
  ('problemas', 'salud-mental', 'Salud mental', 2),
  ('problemas', 'inseguridad', 'Inseguridad / violencia', 3),
  ('problemas', 'consumo', 'Consumo problemático de sustancias', 4),
  ('problemas', 'vivienda', 'Falta de acceso a la vivienda', 5),
  ('problemas', 'participacion', 'Falta de espacios de participación y recreación', 6),
  ('problemas', 'transporte', 'Transporte público deficiente', 7),
  ('problemas', 'conectividad', 'Falta de acceso a tecnología / conectividad', 8),
  ('problemas', 'arraigo', 'Falta de arraigo (los jóvenes se van del distrito)', 9),
  ('problemas', 'otro', 'Otro...', 10),
  ('necesidades', 'empleo', 'Más oportunidades laborales', 0),
  ('necesidades', 'formacion', 'Formación y capacitación profesional', 1),
  ('necesidades', 'salud-mental', 'Apoyo a la salud mental', 2),
  ('necesidades', 'participacion', 'Espacios de participación política y comunitaria', 3),
  ('necesidades', 'deporte-cultura', 'Infraestructura deportiva y cultural', 4),
  ('necesidades', 'vivienda', 'Acceso a créditos o vivienda propia', 5),
  ('necesidades', 'transporte', 'Mejor transporte público', 6),
  ('necesidades', 'becas', 'Becas y acceso a la educación superior', 7),
  ('necesidades', 'conectividad', 'Conectividad y acceso a tecnología', 8),
  ('necesidades', 'adicciones', 'Programas de prevención de adicciones', 9),
  ('comision', 'trabajo-situacion-economica', 'Trabajo y situación económica', 0),
  ('comision', 'modelo-desarrollo-produccion-federalismo', 'Modelo de desarrollo, producción y federalismo', 1),
  ('comision', 'soberania-tierra-defensa', 'Soberanía, tierra y defensa', 2),
  ('comision', 'inteligencia-artificial-plataformas-poder', 'Inteligencia artificial, plataformas y poder: una mirada desde el Sur Global', 3),
  ('comision', 'seguridad', 'Seguridad', 4),
  ('comision', 'educacion', 'Educación', 5),
  ('comision', 'salud-mental', 'Salud mental', 6),
  ('comision', 'vivienda-habitat-urbanismo', 'Vivienda, hábitat y urbanismo', 7),
  ('comision', 'militancia-siglo-xxi', 'Militancia en el siglo XXI', 8),
  ('taller', 'argentina-bicontinental', 'Pensar en la Argentina Bicontinental: Malvinas, Antártida y Atlántico Sur', 0),
  ('taller', 'gestion-municipal', 'Gestión Municipal', 1),
  ('taller', 'politica-legislativa', 'Política legislativa', 2),
  ('taller', 'comunicacion-politica-redes', 'Comunicación política y redes', 3),
  ('taller', 'historia-peronista-vol-i', 'Historia del movimiento peronista (Vol I: gobierno de Perón y resistencia peronista)', 4),
  ('taller', 'historia-peronista-vol-ii', 'Historia del movimiento peronista (Vol II: de 1970 a la actualidad)', 5),
  ('taller', 'seguridad', 'Seguridad', 6),
  ('taller', 'economia', 'Economía', 7)
) as o(field_key, value, label, position) on o.field_key = q.field_key
where q.version_id = '00000000-0000-4000-8000-000000000003'
on conflict (question_id, value) do update set label = excluded.label, position = excluded.position;
