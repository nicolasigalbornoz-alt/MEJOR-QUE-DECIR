#!/usr/bin/env node
/**
 * Importación única de la planilla anterior (Google Sheets / Apps Script).
 *
 * Lee las pestañas "Respuestas encuesta" y "acred", y genera dos SQL para
 * pegar en Supabase → SQL Editor: import-legacy.sql (respuestas y padrón del
 * encuentro) e import-militants.sql (base de compañeros del panel). No se
 * conecta a Supabase ni escribe en la planilla.
 *
 *   node scripts/import-legacy-sheet.mjs            usa la copia local si existe
 *   node scripts/import-legacy-sheet.mjs --refresh  vuelve a descargar la planilla
 *
 * La copia cruda y el SQL quedan en migration-input/ (ignorado por git):
 * contienen datos personales y no se commitean.
 *
 * Del padrón del encuentro solo se toman nombre, provincia, localidad y
 * acreditación. La base de compañeros suma teléfono y mail. Nunca se importan
 * fecha de nacimiento, redes sociales ni el resto de las respuestas.
 *
 * Requiere Node 22.18 o superior (importa catálogos TypeScript de src/).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROVINCES } from "../src/data/provinces.ts";
import { COMMISSIONS, NEEDS, PARTICIPATION_OPTIONS, PROBLEMS, WORKSHOPS } from "../src/features/forms/catalogs.ts";

const SPREADSHEET_ID = "1WrS0vjjeUiRk9iKyYuR1SEJcd-qjrXC6QcU7jJhlrVE";
const RESPONSES_SHEET = "Respuestas encuesta";
const DIRECTORY_SHEET = "acred";
const FORM_SLUG = "mejor-que-decir";
const FORM_VERSION = 1;
const SHEET_UTC_OFFSET = "-03:00";

const OUTPUT_DIR = resolve(import.meta.dirname, "..", "migration-input");
const refresh = process.argv.includes("--refresh");

// ---------- Lectura de la planilla ----------

async function loadSheet(name) {
  const cachePath = resolve(OUTPUT_DIR, `sheet-${slugify(name)}.json`);
  if (!refresh && existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, "utf8"));

  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(name)}`;
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok || !text.includes("google.visualization.Query.setResponse")) {
    throw new Error(`No se pudo leer la pestaña "${name}" (HTTP ${response.status}). Si la planilla ya no es pública, ejecutá sin --refresh usando la copia local.`);
  }
  const payload = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  if (payload.status !== "ok") throw new Error(`La planilla devolvió un error para "${name}".`);
  const table = {
    headers: payload.table.cols.map((col) => col.label || col.id),
    rows: payload.table.rows.map((row) => (row.c ?? []).map((cell) => (cell ? cell.v : null))),
  };
  writeFileSync(cachePath, JSON.stringify(table));
  return table;
}

// ---------- Normalización ----------

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function slugify(value) {
  return normalize(value).replace(/ /g, "-");
}

function text(value, max = 2000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function lookupBy(entries, key, label) {
  const map = new Map();
  for (const entry of entries) map.set(normalize(entry[label]), entry[key]);
  return (value) => map.get(normalize(value));
}

const provinceAliases = new Map([
  ["capital federal", "caba"],
  ["ciudad autonoma de buenos aires", "caba"],
  ["ciudad de buenos aires", "caba"],
  ["caba", "caba"],
  ["bs as", "buenosaires"],
  ["bsas", "buenosaires"],
  ["pba", "buenosaires"],
  ["pcia de buenos aires", "buenosaires"],
  ["provincia de buenos aires", "buenosaires"],
  ["buenos aires", "buenosaires"],
  ["santiago", "santiago"],
  ["sgo del estero", "santiago"],
  ["tierra del fuego antartida e islas del atlantico sur", "tierradelfuego"],
]);

// Partidos que aparecen escritos en lugar de la provincia en el padrón.
const bonaerensePartidos = [
  "almirante brown", "alte brown", "escobar", "esteban echeverria", "florencio varela",
  "ituzaingo", "la matanza", "lanus", "lomas de zamora", "mar del plata", "moron",
  "presidente peron", "tigre", "trenque lauquen", "tres de febrero", "vicente lopez",
];

function provinceId(value) {
  const key = normalize(value).replace(/^(provincia|pcia|prov) (de )?/, "");
  if (!key) return null;
  if (provinceAliases.has(key)) return provinceAliases.get(key);
  const exact = PROVINCES.find((province) => normalize(province.name) === key || province.id === key.replace(/ /g, ""));
  if (exact) return exact.id;
  // Texto libre del padrón: "La Matanza, Buenos Aires", "Córdoba capital", etc.
  const contained = PROVINCES
    .filter((province) => province.id !== "buenosaires" && ` ${key} `.includes(` ${normalize(province.name)} `))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (contained) return contained.id;
  if (/\bcaba\b|capital federal/.test(key)) return "caba";
  if (/\bbuenos? aires?\b|\bbs ?as\b/.test(key)) return "buenosaires";
  if (bonaerensePartidos.some((partido) => ` ${key} `.includes(` ${partido} `))) return "buenosaires";
  return null;
}

const commissionId = lookupBy(COMMISSIONS, "id", "name");
const workshopId = lookupBy(WORKSHOPS, "id", "name");
const problemValue = lookupBy(PROBLEMS, "value", "label");
const needValue = lookupBy(NEEDS, "value", "label");
const participationValue = lookupBy(PARTICIPATION_OPTIONS, "value", "label");

function sheetDate(value) {
  const match = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?/.exec(String(value ?? ""));
  if (!match) return null;
  const [, y, m, d, hh = "0", mm = "0", ss = "0"] = match;
  const pad = (n) => String(n).padStart(2, "0");
  return `${y}-${pad(Number(m) + 1)}-${pad(d)} ${pad(hh)}:${pad(mm)}:${pad(ss)}${SHEET_UTC_OFFSET}`;
}

// ---------- Transformación ----------

const issues = [];
const warn = (sheet, rowNumber, message) => issues.push(`${sheet} fila ${rowNumber}: ${message}`);

function splitList(value) {
  return text(value).split(/;\s*/).map((item) => item.trim()).filter(Boolean);
}

function expectHeaders(table, expected, sheet) {
  for (const [index, header] of Object.entries(expected)) {
    if (normalize(table.headers[index]) !== normalize(header)) {
      throw new Error(`"${sheet}": se esperaba la columna "${header}" en la posición ${index} y está "${table.headers[index]}".`);
    }
  }
}

function buildResponses(table) {
  expectHeaders(table, {
    0: "Marca temporal", 1: "Nombre", 2: "Provincia", 3: "Localidad",
    4: "Participación en espacio político / militancia", 10: "Comisión de interés",
    13: "Taller elegido", 17: "com_acred", 18: "panel_acred", 19: "com_comp", 20: "panel_com",
  }, RESPONSES_SHEET);

  const records = [];
  table.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const nombre = text(row[1], 200);
    if (!nombre) return;

    const provincia = provinceId(row[2]);
    if (!provincia) {
      warn(RESPONSES_SHEET, rowNumber, `provincia no reconocida (${text(row[2], 60)}); se omite la respuesta`);
      return;
    }
    const localidad = text(row[3], 200) || "Sin dato";
    if (!text(row[3])) warn(RESPONSES_SHEET, rowNumber, "sin localidad; se guarda \"Sin dato\"");

    const answers = { nombre, provincia, localidad };
    const set = (key, value) => {
      if (value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && !value.length)) answers[key] = value;
    };

    const participa = participationValue(row[4]);
    if (text(row[4]) && !participa) warn(RESPONSES_SHEET, rowNumber, `participación no reconocida (${text(row[4], 60)})`);
    set("participa", participa);
    set("agrupacion", text(row[5]));
    set("situacionEscala", typeof row[6] === "number" ? row[6] : null);
    set("situacionTexto", text(row[7]));
    set("problematicaTerritorio", text(row[16]));

    const problemas = [];
    let problemaOtro = "";
    for (const item of splitList(row[8])) {
      const otro = /^otro\s*(?:\.\.\.|…|:)\s*(.*)$/i.exec(item);
      const value = otro ? "otro" : problemValue(item);
      if (otro && otro[1]) problemaOtro = text(otro[1], 2000);
      if (!value) warn(RESPONSES_SHEET, rowNumber, `problema no reconocido (${item.slice(0, 60)})`);
      else if (!problemas.includes(value)) problemas.push(value);
    }
    set("problemas", problemas);
    set("problemaOtro", problemaOtro);

    const necesidades = [];
    for (const item of splitList(row[9])) {
      const value = needValue(item);
      if (!value) warn(RESPONSES_SHEET, rowNumber, `necesidad no reconocida (${item.slice(0, 60)})`);
      else if (!necesidades.includes(value)) necesidades.push(value);
    }
    set("necesidades", necesidades);

    const comision = commissionId(row[10]);
    if (text(row[10]) && !comision) warn(RESPONSES_SHEET, rowNumber, `comisión no reconocida (${text(row[10], 60)})`);
    set("comision", comision);
    set("comisionComentario", text(row[14]));

    const taller = workshopId(row[13]);
    if (text(row[13]) && !taller) warn(RESPONSES_SHEET, rowNumber, `taller no reconocido (${text(row[13], 60)})`);
    set("taller", taller);
    set("tallerComentario", text(row[15]));

    set("visionEscala", typeof row[11] === "number" ? row[11] : null);
    set("visionFrase", text(row[12]));

    // Asignación final: la de acreditación, si hubo cambio; si no, la calculada por cupos.
    const assignedCommission = commissionId(row[17]) ?? commissionId(row[19]) ?? null;
    const assignedWorkshop = workshopId(row[18]) ?? workshopId(row[20]) ?? null;
    for (const [value, label] of [[row[17], "comisión acreditada"], [row[19], "comisión asignada"]]) {
      if (text(value) && !commissionId(value)) warn(RESPONSES_SHEET, rowNumber, `${label} no reconocida (${text(value, 60)})`);
    }
    for (const [value, label] of [[row[18], "panel acreditado"], [row[20], "panel asignado"]]) {
      if (text(value) && !workshopId(value)) warn(RESPONSES_SHEET, rowNumber, `${label} no reconocido (${text(value, 60)})`);
    }

    const submittedAt = sheetDate(row[0]);
    if (!submittedAt) warn(RESPONSES_SHEET, rowNumber, "sin fecha; se usa la fecha de importación");

    records.push({ submittedAt, nombre, provincia, localidad, answers, assignedCommission, assignedWorkshop });
  });
  return records;
}

function buildDirectory(table, responses) {
  // Si el padrón tiene un texto que no es provincia (por ejemplo, el partido),
  // se usa la provincia que esa misma persona eligió en la encuesta.
  const surveyProvince = new Map(responses.map((r) => [normalize(r.nombre), r.provincia]));

  expectHeaders(table, {
    2: "Nombre y apellido", 4: "¿De qué provincia/distrito sos?", 5: "¿De qué ciudad sos?", 22: "Acreditado",
  }, DIRECTORY_SHEET);

  const records = [];
  table.rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const nombre = text(row[2], 200);
    if (!nombre) return;
    const provincia = provinceId(row[4]) ?? surveyProvince.get(normalize(nombre)) ?? null;
    if (text(row[4]) && !provincia) warn(DIRECTORY_SHEET, rowNumber, `provincia no reconocida (${text(row[4], 60)}); queda sin provincia`);
    records.push({ nombre, provincia, localidad: text(row[5], 200), acreditado: row[22] === true });
  });
  return records;
}

// ---------- SQL ----------

function literal(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSql(responses, directory) {
  const responseValues = responses.map((r, i) => `  (${i + 1}, ${r.submittedAt ? `${literal(r.submittedAt)}::timestamptz` : "now()"}, ${literal(r.nombre)}, ${literal(r.provincia)}, ${literal(r.localidad)}, ${literal(JSON.stringify(r.answers))}::jsonb, ${literal(r.assignedCommission)}, ${literal(r.assignedWorkshop)})`);
  const directoryValues = directory.map((d) => `  (${literal(d.nombre)}, ${literal(d.provincia)}, ${literal(d.localidad)}, ${literal(d.acreditado)})`);

  return `-- Importación de la planilla anterior: ${responses.length} respuestas y ${directory.length} filas de padrón.
-- Generado por scripts/import-legacy-sheet.mjs el ${new Date().toISOString()}.
-- CONTIENE DATOS PERSONALES: no commitear ni compartir.
-- Requiere la migración 20261020000000_legacy_import_support.sql.
-- Se puede volver a ejecutar: no duplica respuestas ni padrón.

-- Sin tablas temporales: el SQL Editor puede ejecutar cada sentencia en una
-- sesión distinta. Respuestas y asignaciones van en una sola sentencia atómica.

do $$
begin
  if not exists (
    select 1 from public.form_versions fv join public.forms f on f.id = fv.form_id
    where f.slug = ${literal(FORM_SLUG)} and fv.version_number = ${FORM_VERSION}
  ) then
    raise exception 'No existe la versión ${FORM_VERSION} del formulario ${FORM_SLUG}: aplicá migraciones y seed antes.';
  end if;
  if to_regclass('public.submission_assignments') is null then
    raise exception 'Falta aplicar la migración 20261020000000_legacy_import_support.sql.';
  end if;
end $$;

with legacy (row_number, submitted_at, display_name, province_id, locality, answers, commission_id, workshop_id) as (
  values
${responseValues.join(",\n")}
),
target as (
  select fv.id as version_id, f.id as form_id, f.event_id
  from public.forms f
  join public.form_versions fv on fv.form_id = f.id and fv.version_number = ${FORM_VERSION}
  where f.slug = ${literal(FORM_SLUG)}
),
inserted as (
  insert into public.form_submissions (
    form_version_id, form_id, event_id, display_name, normalized_name,
    province_id, locality, answers, submitted_at
  )
  select t.version_id, t.form_id, t.event_id, l.display_name::text, private.normalize_person_name(l.display_name::text),
    l.province_id::text, l.locality::text, l.answers::jsonb, l.submitted_at::timestamptz
  from legacy l cross join target t
  order by l.row_number
  on conflict (form_id, normalized_name) where not is_demo do nothing
  returning id, normalized_name
)
insert into public.submission_assignments (submission_id, commission_id, workshop_id)
select i.id, l.commission_id::text, l.workshop_id::text
from inserted i
join legacy l on private.normalize_person_name(l.display_name::text) = i.normalized_name
where l.commission_id is not null or l.workshop_id is not null
on conflict (submission_id) do update set
  commission_id = excluded.commission_id,
  workshop_id = excluded.workshop_id,
  updated_at = now();

with legacy (display_name, province_id, locality, accredited) as (
  values
${directoryValues.join(",\n")}
)
insert into public.attendee_directory (event_id, display_name, normalized_name, province_id, locality, accredited)
select distinct on (private.normalize_person_name(d.display_name::text))
  f.event_id, d.display_name::text, private.normalize_person_name(d.display_name::text),
  d.province_id::text, d.locality::text, d.accredited::boolean
from legacy d
join public.forms f on f.slug = ${literal(FORM_SLUG)}
where f.event_id is not null
order by private.normalize_person_name(d.display_name::text), d.accredited::boolean desc
on conflict (event_id, normalized_name) do update set
  accredited = public.attendee_directory.accredited or excluded.accredited;

-- Control: comparar con los totales que imprimió el script.
select
  (select count(*) from public.form_submissions s join public.forms f on f.id = s.form_id
    where f.slug = ${literal(FORM_SLUG)} and not s.is_demo) as respuestas,
  (select count(*) from public.submission_assignments) as asignaciones,
  (select count(*) from public.attendee_directory) as padron,
  (select count(*) from public.attendee_directory where accredited) as acreditados;
`;
}

// ---------- Compañeros (base interna del panel) ----------

function phoneText(value) {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  return text(value, 60);
}

function emailText(...values) {
  for (const value of values) {
    const email = text(value, 254).toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
  }
  return "";
}

function buildMilitants(table, directory) {
  const directoryProvince = new Map(directory.map((d) => [normalize(d.nombre), d.provincia]));
  const byName = new Map();
  table.rows.forEach((row) => {
    const nombre = text(row[2], 200);
    if (!nombre) return;
    const key = normalize(nombre);
    const candidate = {
      nombre,
      provincia: directoryProvince.get(key) ?? null,
      localidad: text(row[5], 200),
      telefono: phoneText(row[3]),
      email: emailText(row[1], row[13]),
    };
    const previous = byName.get(key);
    // Ante nombres repetidos, se queda con la fila que tenga más datos de contacto.
    const score = (item) => (item.telefono ? 1 : 0) + (item.email ? 1 : 0);
    if (!previous || score(candidate) > score(previous)) byName.set(key, candidate);
  });
  return [...byName.values()];
}

function buildMilitantsSql(militants) {
  const values = militants.map((m) => `  (${literal(m.nombre)}, ${literal(m.provincia)}, ${literal(m.localidad)}, ${literal(m.telefono)}, ${literal(m.email)})`);
  return `-- Importación de compañeros desde el padrón del Encuentro 2026: ${militants.length} personas.
-- Generado por scripts/import-legacy-sheet.mjs el ${new Date().toISOString()}.
-- CONTIENE DATOS PERSONALES: no commitear ni compartir.
-- Requiere la migración 20261022000000_tags_and_militants.sql.
-- Se puede volver a ejecutar: no duplica compañeros (compara el nombre normalizado).

with padron (full_name, province_id, locality, phone, email) as (
  values
${values.join(",\n")}
),
inserted as (
  insert into public.militants (full_name, province_id, locality, phone, email, source)
  select p.full_name::text, p.province_id::text, p.locality::text, p.phone::text, p.email::text, 'padron-2026'
  from padron p
  where not exists (
    select 1 from public.militants m
    where m.normalized_name = private.normalize_person_name(p.full_name::text)
  )
  returning id
)
insert into public.militant_roles (militant_id, tag_id)
select i.id, t.id
from inserted i
cross join public.tags t
where t.category = 'responsabilidad' and t.name = 'Militante'
on conflict do nothing;

select
  (select count(*) from public.militants where source = 'padron-2026') as companeros_padron,
  (select count(*) from public.militant_roles r join public.tags t on t.id = r.tag_id where t.name = 'Militante') as con_etiqueta_militante;
`;
}

// ---------- Main ----------

mkdirSync(OUTPUT_DIR, { recursive: true });
const responses = buildResponses(await loadSheet(RESPONSES_SHEET));
const directory = buildDirectory(await loadSheet(DIRECTORY_SHEET), responses);
const sqlPath = resolve(OUTPUT_DIR, "import-legacy.sql");
writeFileSync(sqlPath, buildSql(responses, directory));
const militants = buildMilitants(await loadSheet(DIRECTORY_SHEET), directory);
const militantsSqlPath = resolve(OUTPUT_DIR, "import-militants.sql");
writeFileSync(militantsSqlPath, buildMilitantsSql(militants));

const distinctNames = (items) => new Set(items.map((item) => normalize(item.nombre))).size;
console.log(`Respuestas: ${responses.length} (${distinctNames(responses)} nombres distintos)`);
console.log(`Con asignación final: ${responses.filter((r) => r.assignedCommission || r.assignedWorkshop).length}`);
console.log(`Padrón: ${directory.length} filas (${distinctNames(directory)} nombres distintos), ${directory.filter((d) => d.acreditado).length} acreditados, ${directory.filter((d) => !d.provincia).length} sin provincia`);
console.log(`Avisos: ${issues.length}`);
for (const issue of issues.slice(0, 80)) console.log(`  - ${issue}`);
if (issues.length > 80) console.log(`  ... y ${issues.length - 80} más`);
console.log(`Compañeros: ${militants.length} (${militants.filter((m) => m.telefono).length} con teléfono, ${militants.filter((m) => m.email).length} con mail)`);
console.log(`\nSQL generado en ${sqlPath}`);
console.log(`SQL de compañeros generado en ${militantsSqlPath}`);
