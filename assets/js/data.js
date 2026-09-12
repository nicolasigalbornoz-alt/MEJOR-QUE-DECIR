/**
 * Carga y procesamiento de datos de la encuesta "MEJOR QUE DECIR".
 * Fuente preferida: el Google Apps Script (appsScriptUrl en config.js),
 * que lee en vivo la hoja "Respuestas encuesta" de la planilla. Si no
 * está configurado, cae a un CSV publicado (csvUrl, legado) y si tampoco
 * hay eso, a los datos de ejemplo.
 *
 * Todo el procesamiento ocurre en el navegador de quien visita el sitio:
 * no hay backend propio, el "backend" es Google Sheets + Apps Script.
 */
(function () {
  const ESCALA_SITUACION = { "muy mala": 1, "mala": 2, "regular": 3, "buena": 4, "muy buena": 5 };
  const ESCALA_VISION = {
    "muy pesimista": -2,
    "pesimista": -1,
    "ni pesimista ni optimista": 0,
    "neutral": 0,
    "optimista": 1,
    "muy optimista": 2,
  };

  function norm(s) { return window.MQD_normalize(s); }

  function findKey(headers, includesAny) {
    return headers.find((h) => {
      const n = norm(h);
      return includesAny.some((frag) => n.includes(frag));
    });
  }

  function splitMulti(cell, sep) {
    if (!cell) return [];
    return cell.split(sep || ",").map((s) => s.trim()).filter(Boolean);
  }

  function parseCsv(text) {
    const result = Papa.parse(text.trim(), { skipEmptyLines: true });
    const rows = result.data;
    if (!rows.length) return [];
    const headers = rows[0];

    const kProvincia = findKey(headers, ["que provincia", "provincia"]);
    const kLocalidad = findKey(headers, ["localidad", "distrito, ciudad", "ciudad o barrio"]);
    const kSituacionEscala = findKey(headers, ["situacion general"]);
    const kSituacionTexto = findKey(headers, ["contanos brevemente", "situacion de tu distrito"]);
    const kProblemas = findKey(headers, ["problemas de la juventud"]);
    const kNecesidades = findKey(headers, ["que necesitan", "necesitan los", "necesidades"]);
    const kVisionEscala = findKey(headers, ["tan optimista"]);
    const kVisionFrase = findKey(headers, ["pais te gustaria", "pais te gustaria construir"]);
    const kParticipa = findKey(headers, ["participas en algun espacio", "espacio de militancia"]);
    const kNombre = findKey(headers, ["nombre"]);

    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.every((c) => !c)) continue;
      const get = (k) => (k ? (r[headers.indexOf(k)] || "").trim() : "");

      const provinciaRaw = get(kProvincia);
      const provinceId = window.MQD_matchProvince(provinciaRaw);
      if (!provinceId) continue; // fila sin distrito reconocible: se descarta del mapa

      out.push({
        provinceId,
        provinciaRaw,
        localidad: get(kLocalidad),
        situacionEscala: ESCALA_SITUACION[norm(get(kSituacionEscala))] ?? null,
        situacionTexto: get(kSituacionTexto),
        problemas: splitMulti(get(kProblemas)),
        necesidades: splitMulti(get(kNecesidades)),
        visionEscala: ESCALA_VISION[norm(get(kVisionEscala))] ?? null,
        visionFrase: get(kVisionFrase),
        participa: get(kParticipa),
        nombre: get(kNombre),
      });
    }
    return out;
  }

  // Filas que vienen directo del Apps Script (JSON, orden fijo de columnas
  // — ver RESPUESTA_HEADERS en apps-script/Code.gs). A diferencia del CSV
  // de un Google Form, acá el esquema lo definimos nosotros mismos, así
  // que no hace falta adivinar columnas por el texto de la pregunta.
  function parseAppsScriptRows(json) {
    // Posiciones fijas — tienen que coincidir con RESPUESTA_HEADERS y
    // appendResponse() en apps-script/Code.gs:
    // 0 Marca temporal, 1 Nombre, 2 Provincia, 3 Localidad, 4 Participación
    // en espacio político/militancia, 5 Nombre de la agrupación,
    // 6 Situación (1-5), 7 Situación/problemática (texto), 8 Problemas,
    // 9 Necesidades, 10 Comisión de interés, 11 Visión país (-2 a 2),
    // 12 Visión (frase).
    const rows = Array.isArray(json && json.rows) ? json.rows : [];
    const out = [];
    for (const r of rows) {
      if (!r || r.every((c) => c === "" || c == null)) continue;
      const provinciaRaw = (r[2] || "").toString().trim();
      const provinceId = window.MQD_matchProvince(provinciaRaw);
      if (!provinceId) continue;

      const situ = Number(r[6]);
      const vision = Number(r[11]);
      out.push({
        provinceId,
        provinciaRaw,
        localidad: (r[3] || "").toString().trim(),
        participa: (r[4] || "").toString().trim(),
        agrupacion: (r[5] || "").toString().trim(),
        situacionEscala: Number.isFinite(situ) && r[6] !== "" ? situ : null,
        situacionTexto: (r[7] || "").toString().trim(),
        problemas: splitMulti((r[8] || "").toString(), ";"),
        necesidades: splitMulti((r[9] || "").toString(), ";"),
        comisiones: splitMulti((r[10] || "").toString(), ";"),
        visionEscala: Number.isFinite(vision) && r[11] !== "" ? vision : null,
        visionFrase: (r[12] || "").toString().trim(),
        nombre: (r[1] || "").toString().trim(),
      });
    }
    return out;
  }

  function bump(counter, key) {
    if (!key) return;
    counter[key] = (counter[key] || 0) + 1;
  }

  function aggregate(rows) {
    const byProvince = {};
    for (const p of window.MQD_PROVINCES) {
      byProvince[p.id] = {
        id: p.id, name: p.name, region: p.region,
        count: 0, situacionSum: 0, situacionN: 0,
        visionSum: 0, visionN: 0,
        problemas: {}, necesidades: {},
        localidades: new Set(), quotes: [],
      };
    }
    const nacProblemas = {}, nacNecesidades = {}, nacParticipa = {};
    const nacVision = { "-2": 0, "-1": 0, "0": 0, "1": 0, "2": 0 };
    const nacSituacion = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

    for (const row of rows) {
      const b = byProvince[row.provinceId];
      if (!b) continue;
      b.count++;
      if (row.localidad) b.localidades.add(row.localidad);
      if (row.situacionEscala != null) {
        b.situacionSum += row.situacionEscala; b.situacionN++;
        nacSituacion[String(row.situacionEscala)]++;
      }
      if (row.visionEscala != null) {
        b.visionSum += row.visionEscala; b.visionN++;
        nacVision[String(row.visionEscala)]++;
      }
      row.problemas.forEach((p) => { bump(b.problemas, p); bump(nacProblemas, p); });
      row.necesidades.forEach((n) => { bump(b.necesidades, n); bump(nacNecesidades, n); });
      bump(nacParticipa, row.participa);
      const quote = row.situacionTexto || row.visionFrase;
      if (quote && quote.length > 3 && b.quotes.length < 8) {
        b.quotes.push({ text: quote, localidad: row.localidad });
      }
    }

    const provincesWithData = Object.values(byProvince).filter((p) => p.count > 0);
    const maxCount = Math.max(1, ...provincesWithData.map((p) => p.count));

    return {
      totalResponses: rows.length,
      totalProvinces: provincesWithData.length,
      totalLocalidades: new Set(rows.map((r) => norm(r.localidad)).filter(Boolean)).size,
      byProvince, maxCount,
      nacProblemas, nacNecesidades, nacParticipa, nacVision, nacSituacion,
      rows,
    };
  }

  function sortedEntries(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }
  window.MQD_sortedEntries = sortedEntries;

  async function fetchText(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  window.MQD_DATA = {
    async load() {
      const cfg = window.MQD_CONFIG;
      let rows = null;
      let isDemo = false;

      if (cfg.appsScriptUrl && cfg.appsScriptUrl.trim()) {
        try {
          const url = cfg.appsScriptUrl.trim().replace(/\/$/, "") + "?action=responses";
          const json = await fetchJson(url);
          rows = parseAppsScriptRows(json);
        } catch (e) {
          console.warn("No se pudo leer appsScriptUrl, se prueba csvUrl / demo.", e);
        }
      }

      if (rows == null && cfg.csvUrl && cfg.csvUrl.trim()) {
        try {
          rows = parseCsv(await fetchText(cfg.csvUrl.trim()));
        } catch (e) {
          console.warn("No se pudo leer csvUrl, se usa el modo demo.", e);
        }
      }

      if (rows == null && cfg.useDemoFallback) {
        try {
          rows = parseCsv(await fetchText(cfg.demoCsvPath));
          isDemo = true;
        } catch (e) {
          console.error("No se pudo cargar el CSV de ejemplo.", e);
        }
      }

      if (rows == null) return { isDemo: false, empty: true, ...aggregate([]) };
      return { isDemo, empty: rows.length === 0, ...aggregate(rows) };
    },
  };
})();
