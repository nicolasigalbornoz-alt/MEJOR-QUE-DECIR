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

function doGet(e) {
  const action = (e.parameter.action || "").toLowerCase();
  if (action === "search") return handleSearch(e);
  if (action === "responses") return handleResponses();
  if (action === "debug") return handleDebug();
  return jsonOut({ error: "Acción desconocida. Usá ?action=search, ?action=responses o ?action=debug" });
}

// Diagnóstico temporal: a qué planilla está atado el script y qué
// pestañas ve, para depurar el autocompletado si no encuentra a nadie.
// Es de solo lectura, no expone filas del padrón, solo nombres de hoja
// y encabezados. Se puede borrar una vez que todo funcione.
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
    appendResponse(data);
    return jsonOut({ ok: true });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

// ---------- Autocompletar por nombre (solo nombre + provincia + ciudad) ----------

function handleSearch(e) {
  const q = normalizeText(e.parameter.q || "");
  if (q.length < 2) return jsonOut([]);

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(PADRON_SHEET_NAME);
  if (!sheet) return jsonOut([]);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return jsonOut([]);
  const headers = values[0];
  const iNombre = headerIndex(headers, PADRON_COLS.nombre);
  const iProv = headerIndex(headers, PADRON_COLS.provincia);
  const iCiudad = headerIndex(headers, PADRON_COLS.ciudad);
  if (iNombre === -1) return jsonOut([]);

  const seen = {};
  const out = [];
  for (let r = 1; r < values.length && out.length < 8; r++) {
    const nombre = (values[r][iNombre] || "").toString().trim();
    if (!nombre) continue;
    const key = normalizeText(nombre);
    if (seen[key] || key.indexOf(q) === -1) continue;
    seen[key] = true;
    out.push({
      nombre: nombre,
      provincia: iProv === -1 ? "" : (values[r][iProv] || "").toString().trim(),
      ciudad: iCiudad === -1 ? "" : (values[r][iCiudad] || "").toString().trim(),
    });
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
    Array.isArray(data.comisiones) ? data.comisiones.join("; ") : "",
    data.visionEscala != null ? data.visionEscala : "",
    (data.visionFrase || "").toString().trim(),
  ]);
}

// ---------- Exponer respuestas para el mapa / síntesis ----------

function handleResponses() {
  const sheet = getOrCreateResponseSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values.length ? values[0] : RESPUESTA_HEADERS;
  const rows = values.slice(1).filter((r) => r.some((c) => c !== "" && c != null));
  // Fechas -> ISO string para que viajen bien como JSON.
  const cleanRows = rows.map((r) =>
    r.map((c) => (c instanceof Date ? c.toISOString() : c))
  );
  return jsonOut({ headers: headers, rows: cleanRows });
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
