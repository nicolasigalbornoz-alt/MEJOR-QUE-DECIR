/**
 * MEJOR QUE DECIR — backend en Google Apps Script.
 *
 * Qué hace:
 *  1) Recibe las respuestas del formulario único del sitio (encuesta.html)
 *     y las guarda en una hoja nueva de esta misma planilla ("Respuestas
 *     encuesta"). NUNCA toca ni reescribe el padrón de inscriptos: esa
 *     hoja solo se LEE, para el autocompletado.
 *  2) Busca coincidencias de nombre en el padrón de inscriptos (la hoja
 *     "Respuestas de formulario 1") para autocompletar provincia/ciudad
 *     — SOLO devuelve nombre, provincia y ciudad, nunca teléfono, mail,
 *     fecha de nacimiento ni Instagram.
 *  3) Expone las respuestas de la encuesta como JSON para que el sitio
 *     arme el mapa federal y la síntesis.
 *  4) Recibe las actas (Word) que suben los responsables de comisión
 *     desde el panel de administración (admin.html), las guarda en una
 *     carpeta de Drive y registra el link en la hoja "Actas" para que
 *     la síntesis las muestre como parte del informe final.
 *
 * Rendimiento: tanto el padrón como las respuestas se guardan un rato en
 * CacheService (memoria compartida entre TODAS las visitas al sitio, no
 * por usuario) para no releer la planilla entera en cada pedido — con
 * mucha gente mirando el mapa/síntesis a la vez el día del encuentro,
 * releer la hoja completa en cada request es lo que hace sentir lento
 * al sitio. Cuando entra una respuesta nueva, se invalida el cache de
 * respuestas al toque para que no tarde en aparecer.
 *
 * Instalación: ver /APPS_SCRIPT_SETUP.md en el repo.
 */

const PADRON_SHEET_NAME = "Hoja 1"; // hoja con los inscriptos al encuentro (solo lectura)
const RESPUESTAS_SHEET_NAME = "Respuestas encuesta"; // hoja única de respuestas (se crea sola si no existe)

// Nombres de columna EXACTOS de la hoja de inscriptos (ajustar si difieren).
const PADRON_COLS = {
  nombre: "Nombre y apellido",
  provincia: "¿De qué provincia/distrito sos?",
  ciudad: "¿De qué ciudad sos?",
};

// El orden acá tiene que coincidir exactamente con el array que arma
// appendResponse() más abajo (misma posición = misma columna), y con
// las posiciones que lee assets/js/data.js (parseAppsScriptRows).
const RESPUESTA_HEADERS = [
  "Marca temporal",
  "Nombre",
  "Provincia",
  "Localidad",
  "Participación en espacio político / militancia",
  "Nombre de la agrupación",
  "Situación distrito (1-5)",
  "Situación / problemática (texto)",
  "Problemas juventud",
  "Necesidades",
  "Comisión de interés",
  "Visión país (-2 a 2)",
  "Visión (frase)",
];

// Cuánto se guarda cada cosa en CacheService antes de releer la planilla.
// Las respuestas se invalidan solas apenas entra una nueva (ver
// appendResponse), así que este número es más un tope de seguridad que
// un retraso real. El padrón no cambia durante el evento, así que puede
// quedarse cacheado más tiempo sin problema.
const RESPONSES_CACHE_SECONDS = 30;
const PADRON_CACHE_SECONDS = 1800; // 30 minutos
const RESPONSES_CACHE_KEY = "mqd_responses_json_v2";
const PADRON_CACHE_KEY = "mqd_padron_json_v2";

// ---------- Actas de comisión (panel de administración) ----------
const ACTAS_SHEET_NAME = "Actas"; // hoja única con el registro de actas subidas
const ACTAS_FOLDER_NAME = "Actas de comisiones — Mejor que decir"; // carpeta de Drive (se crea sola)
const ACTAS_CACHE_KEY = "mqd_actas_json_v1";
const ACTAS_HEADERS = ["Marca temporal", "Comisión", "Nombre de archivo", "Link"];

function doGet(e) {
  const action = (e.parameter.action || "").toLowerCase();
  if (action === "search") return handleSearch(e);
  if (action === "responses") return handleResponses();
  if (action === "actas") return handleActas();
  if (action === "debug") return handleDebug();
  return jsonOut({ error: "Acción desconocida. Usá ?action=search, ?action=responses, ?action=actas o ?action=debug" });
}

// Diagnóstico temporal: a qué planilla está atado el script y qué
// pestañas ve, para depurar el autocompletado si no encuentra a nadie.
// Es de solo lectura, no expone filas del padrón, solo nombres de hoja
// y encabezados. Se puede borrar una vez que todo funcione. A propósito
// no usa cache: siempre lee la planilla en vivo para diagnosticar.
function handleDebug() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const info = {
      spreadsheetName: ss ? ss.getName() : null,
      spreadsheetId: ss ? ss.getId() : null,
      sheetNames: ss ? ss.getSheets().map((s) => s.getName()) : [],
    };
    const padron = ss ? ss.getSheetByName(PADRON_SHEET_NAME) : null;
    info.padronSheetNameBuscado = PADRON_SHEET_NAME;
    info.padronEncontrado = !!padron;
    if (padron) {
      const values = padron.getDataRange().getValues();
      info.padronHeaders = values.length ? values[0] : [];
      info.padronFilas = values.length - 1;
    }
    return jsonOut(info);
  } catch (err) {
    return jsonOut({ error: String(err && err.message ? err.message : err) });
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.tipo === "acta") {
      return jsonOut(handleActaUpload(data));
    }
    appendResponse(data);
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// ---------- Autocompletar por nombre (solo nombre + provincia + ciudad) ----------

// Padrón reducido a los 3 datos que se muestran, guardado en cache: así
// cada letra que alguien tipea en el buscador no vuelve a leer la hoja
// entera, solo filtra el array ya cacheado.
function getPadron() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(PADRON_CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PADRON_SHEET_NAME);
  if (!sheet) return { found: false, rows: [] };

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { found: false, rows: [] };
  const headers = values[0];
  const iNombre = headerIndex(headers, PADRON_COLS.nombre);
  const iProv = headerIndex(headers, PADRON_COLS.provincia);
  const iCiudad = headerIndex(headers, PADRON_COLS.ciudad);
  if (iNombre === -1) return { found: false, rows: [] };

  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const nombre = (values[r][iNombre] || "").toString().trim();
    if (!nombre) continue;
    rows.push({
      nombre: nombre,
      provincia: iProv === -1 ? "" : (values[r][iProv] || "").toString().trim(),
      ciudad: iCiudad === -1 ? "" : (values[r][iCiudad] || "").toString().trim(),
    });
  }
  const result = { found: true, rows: rows };
  try {
    cache.put(PADRON_CACHE_KEY, JSON.stringify(result), PADRON_CACHE_SECONDS);
  } catch (err) {
    // Padrón muy grande para cachear (CacheService tiene un tope de
    // 100KB por clave): seguimos sin cache en vez de romper el pedido.
  }
  return result;
}

function handleSearch(e) {
  const q = normalizeText(e.parameter.q || "");
  if (q.length < 2) return jsonOut([]);

  const padron = getPadron();
  if (!padron.found) return jsonOut([]);

  const seen = {};
  const out = [];
  for (let i = 0; i < padron.rows.length && out.length < 8; i++) {
    const row = padron.rows[i];
    const key = normalizeText(row.nombre);
    if (seen[key] || key.indexOf(q) === -1) continue;
    seen[key] = true;
    out.push(row);
  }
  return jsonOut(out);
}

function headerIndex(headers, name) {
  const target = normalizeText(name);
  for (let i = 0; i < headers.length; i++) {
    if (normalizeText(headers[i]) === target) return i;
  }
  return -1;
}

function normalizeText(s) {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// ---------- Guardar respuestas ----------

function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getOrCreateResponseSheet() {
  return getOrCreateSheet(RESPUESTAS_SHEET_NAME, RESPUESTA_HEADERS);
}

function appendResponse(data) {
  const sheet = getOrCreateResponseSheet();
  sheet.appendRow([
    new Date(),
    (data.nombre || "").toString().trim(),
    (data.provincia || "").toString().trim(),
    (data.localidad || "").toString().trim(),
    (data.participa || "").toString().trim(),
    (data.agrupacion || "").toString().trim(),
    data.situacionEscala || "",
    (data.situacionTexto || "").toString().trim(),
    Array.isArray(data.problemas) ? data.problemas.join("; ") : "",
    Array.isArray(data.necesidades) ? data.necesidades.join("; ") : "",
    (data.comision || "").toString().trim(),
    data.visionEscala != null ? data.visionEscala : "",
    (data.visionFrase || "").toString().trim(),
  ]);
  // Que la respuesta recién guardada aparezca ya en el mapa/síntesis, sin
  // esperar a que venza el cache de ?action=responses.
  CacheService.getScriptCache().remove(RESPONSES_CACHE_KEY);
}

// ---------- Exponer respuestas para el mapa / síntesis ----------

function handleResponses() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(RESPONSES_CACHE_KEY);
  if (cached) return jsonOutRaw(cached);

  const sheet = getOrCreateResponseSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0] : RESPUESTA_HEADERS;
  const rows = values.slice(1).filter((r) => r.some((c) => c !== "" && c != null));
  // Fechas -> ISO string para que viajen bien como JSON.
  const cleanRows = rows.map((r) =>
    r.map((c) => (c instanceof Date ? c.toISOString() : c))
  );
  const json = JSON.stringify({ headers: headers, rows: cleanRows });
  try {
    cache.put(RESPONSES_CACHE_KEY, json, RESPONSES_CACHE_SECONDS);
  } catch (err) {
    // Demasiadas respuestas para cachear (>100KB): seguimos sin cache,
    // el pedido igual se responde, solo que sin acelerar el siguiente.
  }
  return jsonOutRaw(json);
}

// ---------- Actas de comisión (subidas desde admin.html) ----------

// Carpeta de Drive donde se guardan las actas — se crea sola la primera
// vez (find-or-create por nombre, así no depende de un ID pegado a mano).
function getActasFolder() {
  const existentes = DriveApp.getFoldersByName(ACTAS_FOLDER_NAME);
  if (existentes.hasNext()) return existentes.next();
  return DriveApp.createFolder(ACTAS_FOLDER_NAME);
}

function handleActaUpload(data) {
  const comision = (data.comision || "").toString().trim();
  const nombreArchivo = (data.archivoNombre || "acta.docx").toString().trim();
  const mimeType = (data.mimeType || "application/vnd.openxmlformats-officedocument.wordprocessingml.document").toString();
  const base64 = (data.archivoBase64 || "").toString();
  if (!comision) throw new Error("Falta indicar la comisión.");
  if (!base64) throw new Error("Falta el archivo.");

  const bytes = Utilities.base64Decode(base64);
  const blob = Utilities.newBlob(bytes, mimeType, nombreArchivo);
  const file = getActasFolder().createFile(blob);
  // Cualquiera con el link puede VER/descargar (no editar) — así el
  // informe final puede enlazar el acta sin que el visitante necesite
  // iniciar sesión con una cuenta de Google.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const sheet = getOrCreateSheet(ACTAS_SHEET_NAME, ACTAS_HEADERS);
  sheet.appendRow([new Date(), comision, nombreArchivo, file.getUrl()]);
  CacheService.getScriptCache().remove(ACTAS_CACHE_KEY);

  return { ok: true, url: file.getUrl() };
}

function handleActas() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(ACTAS_CACHE_KEY);
  if (cached) return jsonOutRaw(cached);

  const sheet = getOrCreateSheet(ACTAS_SHEET_NAME, ACTAS_HEADERS);
  const values = sheet.getDataRange().getValues();
  const rows = values.slice(1).filter((r) => r.some((c) => c !== "" && c != null));
  const cleanRows = rows.map((r) => r.map((c) => (c instanceof Date ? c.toISOString() : c)));
  const json = JSON.stringify({ headers: ACTAS_HEADERS, rows: cleanRows });
  try {
    cache.put(ACTAS_CACHE_KEY, json, RESPONSES_CACHE_SECONDS);
  } catch (err) {
    // lista de actas muy larga para cachear: seguimos sin cache.
  }
  return jsonOutRaw(json);
}

function jsonOut(obj) {
  return jsonOutRaw(JSON.stringify(obj));
}

function jsonOutRaw(jsonString) {
  return ContentService.createTextOutput(jsonString).setMimeType(
    ContentService.MimeType.JSON
  );
}
