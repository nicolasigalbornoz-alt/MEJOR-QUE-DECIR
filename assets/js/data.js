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
        comision: (r[10] || "").toString().trim(),
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

  // ---------- Velocidad: cache entre páginas + timeout al backend ----------
  // Google Apps Script puede tardar (a veces bastante) en responder,
  // sobre todo con mucha gente consultando el mapa/síntesis a la vez el
  // día del encuentro. Dos cosas para que el sitio se sienta rápido de
  // verdad en vez de dejar a la persona mirando el esqueleto de carga:
  //  1) Se cachean las filas ya parseadas en sessionStorage un rato corto,
  //     así navegar entre inicio → mapa → síntesis no vuelve a pedir lo
  //     mismo al backend en cada página.
  //  2) El pedido al backend corre contra un timeout: si tarda más de la
  //     cuenta, se muestra la demo (o el cache) al toque, y el pedido
  //     real sigue en curso igual — si termina llegando, se cachea para
  //     la próxima página (aunque ya no cambie lo que se ve ahora).
  const ROWS_CACHE_KEY = "mqd_rows_cache_v1";
  const ROWS_CACHE_TTL_MS = 25000; // 25s: alcanza para navegar sin re-pedir, corto para seguir "en vivo"
  // OJO: Apps Script tiene un "piso" de latencia de varios segundos incluso
  // ya cacheado del lado del servidor (el redirect a script.googleusercontent.com
  // que hace SIEMPRE, cache o no) — medido en la práctica, entre 3 y 4
  // segundos en condiciones normales. Un timeout de 4000ms (el valor
  // original) quedaba demasiado justo: cualquier variación normal de red
  // hacía caer al modo demo aunque el backend funcionara bien, mostrando
  // "96 respuestas" (el dataset de ejemplo) en vez de las respuestas
  // reales. 8000ms da margen real sin volver a la espera larga de antes.
  const FETCH_TIMEOUT_MS = 8000;

  function readRowsCache() {
    try {
      const raw = sessionStorage.getItem(ROWS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.ts !== "number" || !Array.isArray(parsed.rows)) return null;
      if (Date.now() - parsed.ts > ROWS_CACHE_TTL_MS) return null;
      return parsed.rows;
    } catch (e) {
      return null; // modo privado, cuota llena, etc. — seguimos sin cache
    }
  }

  function writeRowsCache(rows) {
    try {
      sessionStorage.setItem(ROWS_CACHE_KEY, JSON.stringify({ ts: Date.now(), rows }));
    } catch (e) {
      // no es crítico: el sitio funciona igual, solo sin acelerar la próxima página
    }
  }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout de " + ms + "ms")), ms);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); }
      );
    });
  }

  window.MQD_DATA = {
    async load() {
      const cfg = window.MQD_CONFIG;
      let rows = null;
      let isDemo = false;

      const cachedRows = readRowsCache();
      if (cachedRows) {
        rows = cachedRows;
      } else if (cfg.appsScriptUrl && cfg.appsScriptUrl.trim()) {
        try {
          const url = cfg.appsScriptUrl.trim().replace(/\/$/, "") + "?action=responses";
          const realFetch = fetchJson(url).then((json) => {
            const parsed = parseAppsScriptRows(json);
            writeRowsCache(parsed); // por si el timeout ganó la carrera, igual queda listo para la próxima página
            return parsed;
          });
          rows = await withTimeout(realFetch, FETCH_TIMEOUT_MS);
        } catch (e) {
          console.warn("No se pudo leer appsScriptUrl a tiempo, se prueba csvUrl / demo.", e);
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
