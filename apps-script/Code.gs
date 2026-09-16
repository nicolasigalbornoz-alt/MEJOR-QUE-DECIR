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
 * al sitio. El informe (mapa/síntesis) no se recalcula en cada respuesta
 * nueva: se actualiza cada REPORT_REFRESH_EVERY_N respuestas, o cuando
 * pasan REPORT_REFRESH_MAX_AGE_SECONDS sin llegar a esa cantidad — lo que
 * pase primero (ver appendResponse). Así no se recalcula todo el tiempo,
 * pero tampoco se queda desactualizado mucho rato si llegan pocas
 * respuestas.
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
  "Taller elegido",
];

// Cuánto se guarda cada cosa en CacheService antes de releer la planilla.
// El padrón no cambia durante el evento, así que puede quedarse cacheado
// mucho tiempo sin problema. Las respuestas usan una política distinta,
// pensada para no recalcular el informe todo el tiempo — ver
// REPORT_REFRESH_EVERY_N / REPORT_REFRESH_MAX_AGE_SECONDS y appendResponse().
const PADRON_CACHE_SECONDS = 1800; // 30 minutos
const RESPONSES_CACHE_KEY = "mqd_responses_json_v2";
const PADRON_CACHE_KEY = "mqd_padron_json_v2";

// El informe (mapa/síntesis) se refresca cada 10 respuestas nuevas, o
// cada 20 minutos si en ese rato no se juntaron 10 — lo que pase primero.
// REPORT_REFRESH_MAX_AGE_SECONDS es el TTL "de tope" del cache: si nunca
// se llega a REPORT_REFRESH_EVERY_N, el cache vence solo a los 20 minutos
// y el siguiente pedido recalcula. PENDING_COUNT_KEY cuenta, en
// PropertiesService (persiste entre ejecuciones, a diferencia de una
// variable normal), cuántas respuestas nuevas entraron desde el último
// refresco.
const REPORT_REFRESH_EVERY_N = 10;
const REPORT_REFRESH_MAX_AGE_SECONDS = 1200; // 20 minutos
const RESPONSES_CACHE_SECONDS = REPORT_REFRESH_MAX_AGE_SECONDS;
const PENDING_COUNT_KEY = "mqd_pending_count_v1";

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
    if (data.tipo === "adminLogin") {
      return jsonOut(handleAdminLogin(data));
    }
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
    (data.taller || "").toString().trim(),
  ]);
  bumpPendingCountAndMaybeRefresh();
}

// Cuenta esta respuesta nueva contra el lote de REPORT_REFRESH_EVERY_N; al
// llegar al lote, invalida el cache del informe (se recalcula en el
// próximo ?action=responses) y reinicia el contador. Si no se llega al
// lote, el informe igual se refresca solo cuando venza el TTL del cache
// (REPORT_REFRESH_MAX_AGE_SECONDS) — no hace falta hacer nada más acá
// para eso.
//
// Usa LockService porque, con varias personas mandando la encuesta casi
// al mismo tiempo (esperable el día del encuentro), dos ejecuciones
// podrían leer el mismo valor del contador y pisarse una a la otra sin
// esto — no arruinaría nada grave, pero el refresco cada 10 dejaría de
// ser preciso.
function bumpPendingCountAndMaybeRefresh() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (err) {
    return; // no se pudo tomar el lock a tiempo: la respuesta ya se guardó igual, solo no cuenta para el lote esta vez
  }
  try {
    const props = PropertiesService.getScriptProperties();
    const count = (Number(props.getProperty(PENDING_COUNT_KEY)) || 0) + 1;
    if (count >= REPORT_REFRESH_EVERY_N) {
      CacheService.getScriptCache().remove(RESPONSES_CACHE_KEY);
      props.setProperty(PENDING_COUNT_KEY, "0");
    } else {
      props.setProperty(PENDING_COUNT_KEY, String(count));
    }
  } finally {
    lock.releaseLock();
  }
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

// Ejecutar a mano desde el editor (▶ Ejecutar) cuando quieras que
// ?action=responses recalcule YA en vez de esperar el refresco automático
// (cada 10 respuestas nuevas o 20 minutos, lo que pase primero — ver
// bumpPendingCountAndMaybeRefresh). Sirve sobre todo para probar que una
// respuesta de prueba ya se ve en el mapa/síntesis sin tener que esperar.
// No hace falta para el uso normal del sitio ni requiere reimplementar.
function forzarRefrescoDeInforme() {
  CacheService.getScriptCache().remove(RESPONSES_CACHE_KEY);
  PropertiesService.getScriptProperties().setProperty(PENDING_COUNT_KEY, "0");
  Logger.log("Listo: el próximo ?action=responses va a recalcular de cero.");
}

// ---------- Login del panel de administración (admin.html) ----------

// El usuario/contraseña NUNCA viven en el código del sitio (JS que le
// llega a cualquier visitante) ni en este archivo (que también termina
// público, en el repo de GitHub) — viven como "Propiedades del script",
// que se cargan a mano una sola vez desde el editor de Apps Script
// (ícono de engranaje "Configuración del proyecto" > "Propiedades del
// script" > agregar ADMIN_USER y ADMIN_PASS) y nunca se comitean a
// ningún lado. Así ni mirar el repo ni hacer "ver código fuente" del
// sitio revela las credenciales reales.
function handleAdminLogin(data) {
  const props = PropertiesService.getScriptProperties();
  const usuarioOk = props.getProperty("ADMIN_USER");
  const claveOk = props.getProperty("ADMIN_PASS");
  if (!usuarioOk || !claveOk) {
    throw new Error("El panel de administración todavía no tiene usuario/contraseña configurados (faltan las Propiedades del script ADMIN_USER/ADMIN_PASS).");
  }
  const usuario = (data.usuario || "").toString().trim();
  const clave = (data.clave || "").toString();
  if (usuario === usuarioOk && clave === claveOk) {
    return { ok: true };
  }
  return { ok: false, error: "Usuario o contraseña incorrectos." };
}

// ---------- Actas de comisión (subidas desde admin.html) ----------

// Ejecutar UNA VEZ a mano desde el editor (▶ Ejecutar, elegir esta
// función arriba) después de pegar este código. Google Apps Script solo
// pide autorizar un permiso NUEVO (acá, Google Drive) cuando alguna
// función se corre desde el editor con ese permiso adentro — desplegar
// una "Nueva versión" del Web App NO alcanza por sí solo para que
// aparezca el cartel de autorización. Sin este paso, todas las subidas
// de actas fallan en silencio (para quien sube, con "no pudimos subir
// el archivo"; en la planilla, sin ningún error visible ni fila nueva).
// De paso crea (si no existe todavía) la carpeta de Drive donde van a
// quedar las actas, y deja su link en el registro de ejecución (menú
// Ver > Registros de ejecución, o el panel que se abre solo después de
// ejecutar) para saber exactamente dónde están guardadas.
function autorizarPermisoDeDrive() {
  const folder = getActasFolder();
  Logger.log("Carpeta de actas en Drive: " + folder.getUrl());
}

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

// ---------- Panel de cupos (comisiones y talleres) ----------

// Cupos indicados por el equipo organizador: 135 por comisión, 115 por
// taller. Las listas de nombres tienen que coincidir EXACTO con las que
// arma assets/js/encuesta.js (COMISIONES / TALLERES) — el conteo cuenta
// contra estos nombres, así que si cambia uno hay que cambiar los dos
// lados y volver a ejecutar crearPanelDeCupos().
const CUPOS_SHEET_NAME = "Panel de cupos";
const CUPO_POR_COMISION = 135;
const CUPO_POR_TALLER = 115;
const COMISIONES_CUPO = [
  "Trabajo y producción",
  "Modelo de desarrollo y federalismo",
  "Soberanía, defensa e integración territorial",
  "Desafíos éticos y políticos de la IA: una mirada desde el sur global",
  "Seguridad",
  "Militancia territorial",
];
const TALLERES_CUPO = [
  "Pensar en la Argentina Bicontinental: Malvinas, Antártida y Atlántico Sur",
  "Gestión Municipal",
  "Política legislativa",
  "Comunicación política y redes",
  "Historia del movimiento peronista",
  "Seguridad",
  "Economía",
];

function numeroAColumna(n) {
  let s = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Ejecutar UNA VEZ a mano desde el editor (▶ Ejecutar, elegir esta
// función arriba) para crear la pestaña "Panel de cupos". Se completa
// sola con fórmulas que leen "Respuestas encuesta" — cada respuesta
// nueva de la encuesta recalcula el conteo automáticamente, sin que
// haga falta tocar nada más.
//
// OJO: si "Respuestas encuesta" ya existía de antes con el esquema
// viejo (sin la columna "Taller elegido"), primero hay que BORRAR esa
// pestaña entera (clic derecho en su nombre → Eliminar) para que se
// vuelva a crear sola con el esquema actual — si no, esta función tira
// un error avisando justamente eso.
//
// Se puede volver a ejecutar cuando quieras (por ejemplo si cambia
// algún cupo o la lista de comisiones/talleres): reconstruye la
// pestaña "Panel de cupos" entera, nunca toca "Respuestas encuesta".
function crearPanelDeCupos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const respSheet = getOrCreateResponseSheet();
  const respHeaders = respSheet.getRange(1, 1, 1, respSheet.getLastColumn()).getValues()[0];
  const colComisionIdx = respHeaders.indexOf("Comisión de interés");
  const colTallerIdx = respHeaders.indexOf("Taller elegido");
  if (colComisionIdx === -1 || colTallerIdx === -1) {
    throw new Error('La hoja "Respuestas encuesta" tiene un esquema viejo (sin "Taller elegido"). Borrá esa pestaña entera y volvé a ejecutar esta función.');
  }
  const colComision = numeroAColumna(colComisionIdx + 1);
  const colTaller = numeroAColumna(colTallerIdx + 1);

  const existente = ss.getSheetByName(CUPOS_SHEET_NAME);
  if (existente) ss.deleteSheet(existente);
  const sheet = ss.insertSheet(CUPOS_SHEET_NAME);

  sheet.getRange("A1").setValue("Panel de cupos — se completa solo con las respuestas de la encuesta");
  sheet.getRange("A1:F1").merge();
  sheet.getRange("A1").setFontWeight("bold").setFontSize(13);

  const headerRow = 3;
  sheet.getRange(headerRow, 1, 1, 6).setValues([["Tipo", "Nombre", "Cupo", "Confirmados", "Disponibles", "% ocupado"]]);
  sheet.getRange(headerRow, 1, 1, 6).setFontWeight("bold").setBackground("#5b3f86").setFontColor("#ffffff");

  let row = headerRow + 1;

  COMISIONES_CUPO.forEach((nombre) => {
    sheet.getRange(row, 1).setValue("Comisión");
    sheet.getRange(row, 2).setValue(nombre);
    sheet.getRange(row, 3).setValue(CUPO_POR_COMISION);
    sheet.getRange(row, 4).setFormula(`=COUNTIF('${RESPUESTAS_SHEET_NAME}'!${colComision}:${colComision},$B${row})`);
    sheet.getRange(row, 5).setFormula(`=C${row}-D${row}`);
    const pct = sheet.getRange(row, 6);
    pct.setFormula(`=IF(C${row}=0,0,D${row}/C${row})`);
    pct.setNumberFormat("0.0%");
    row++;
  });

  row++; // fila separadora entre comisiones y talleres

  TALLERES_CUPO.forEach((nombre) => {
    sheet.getRange(row, 1).setValue("Taller");
    sheet.getRange(row, 2).setValue(nombre);
    sheet.getRange(row, 3).setValue(CUPO_POR_TALLER);
    sheet.getRange(row, 4).setFormula(`=COUNTIF('${RESPUESTAS_SHEET_NAME}'!${colTaller}:${colTaller},$B${row})`);
    sheet.getRange(row, 5).setFormula(`=C${row}-D${row}`);
    const pct = sheet.getRange(row, 6);
    pct.setFormula(`=IF(C${row}=0,0,D${row}/C${row})`);
    pct.setNumberFormat("0.0%");
    row++;
  });

  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 340);
  sheet.setColumnWidths(3, 4, 90);

  // Formato condicional en "Disponibles": rojo si se llegó al cupo,
  // amarillo si quedan 10 lugares o menos. El orden importa: la regla de
  // rojo va primero para que gane sobre la de amarillo en 0.
  const firstDataRow = headerRow + 1;
  const lastDataRow = row - 1;
  const dispRange = sheet.getRange(firstDataRow, 5, lastDataRow - firstDataRow + 1, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThanOrEqualTo(0)
      .setBackground("#f4c7c3").setFontColor("#990000")
      .setRanges([dispRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberLessThanOrEqualTo(10)
      .setBackground("#fff2cc").setFontColor("#7f6000")
      .setRanges([dispRange]).build(),
  ]);
  sheet.setFrozenRows(headerRow);

  Logger.log("Panel de cupos creado/actualizado.");
}

function jsonOut(obj) {
  return jsonOutRaw(JSON.stringify(obj));
}

function jsonOutRaw(jsonString) {
  return ContentService.createTextOutput(jsonString).setMimeType(
    ContentService.MimeType.JSON
  );
}
