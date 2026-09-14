/**
 * Motor del mapa federal — hecho de cero con Leaflet: polígonos reales de
 * las 23 provincias + CABA como punto, sobre fondo liso propio (sin
 * imágenes de mapa de terceros, así no lleva ninguna marca de agua). El
 * color codifica la cantidad de respuestas (escala secuencial de un solo
 * tono, claro→oscuro).
 *
 * window.MQD_MAP expone el motor de dibujo para que lo use tanto
 * mapa.html (versión interactiva completa, con hoja de detalle por
 * distrito) como sintesis.html (mini-mapa de solo lectura, la "foto" del
 * mapa dentro del documento).
 */
window.MQD_MAP = (function () {
  const RAMP_VARS = ["--seq-150", "--seq-250", "--seq-350", "--seq-450", "--seq-550", "--seq-650"];
  // Provincias sin ninguna respuesta: el tono más pálido de la misma escala
  // (no el gris de fondo del mapa) para que el distrito siga viéndose como
  // parte del mapa en vez de desaparecer contra el fondo.
  const EMPTY_VAR = "--seq-100";
  const GEOJSON_URL = "assets/data/argentina-provincias.geojson";

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function bucketFor(count, maxCount) {
    if (count <= 0) return -1;
    const ratio = maxCount <= 1 ? 1 : (count - 1) / (maxCount - 1);
    return Math.min(RAMP_VARS.length - 1, Math.floor(ratio * RAMP_VARS.length));
  }

  async function loadGeoJson() {
    const res = await fetch(GEOJSON_URL, { cache: "force-cache" });
    if (!res.ok) throw new Error("No se pudo cargar el mapa (" + res.status + ")");
    return res.json();
  }

  function renderLegend(el) {
    const ramp = [cssVar(EMPTY_VAR), ...RAMP_VARS.map((v) => cssVar(v))];
    el.innerHTML = `
      <span>Sin respuestas</span>
      <span class="ramp">${ramp.map((c) => `<span style="background:${c}"></span>`).join("")}</span>
      <span>Más respuestas</span>
    `;
  }

  // Dibuja el choropleth en cualquier contenedor.
  // opts:
  //  - interactive (default true): si es false, se apaga zoom/pan/hover/tap
  //    — para la "foto" de solo lectura del documento de síntesis.
  //  - onFeatureClick(provinceId, layer, resetStyleFn): si se pasa, se
  //    engancha en cada distrito (polígono o el punto de CABA); quien la
  //    pase decide qué hacer al tocar (mapa.html abre la hoja de detalle).
  function render(mapEl, geo, data, opts) {
    opts = opts || {};
    const interactive = opts.interactive !== false;

    const map = L.map(mapEl, {
      zoomControl: interactive,
      attributionControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      tap: interactive,
      minZoom: 4,
      maxZoom: 8,
      zoomSnap: 0.25,
      worldCopyJump: false,
    }).setView([-38.4, -63.6], 4);

    const emptyFill = cssVar(EMPTY_VAR) || "#cde2fb";

    function baseStyleFor(provinceId) {
      const stat = data.byProvince[provinceId];
      const bucket = bucketFor(stat.count, data.maxCount);
      const fill = bucket >= 0 ? cssVar(RAMP_VARS[bucket]) : emptyFill;
      return {
        fillColor: fill,
        fillOpacity: 0.82,
        color: "#fff",
        weight: 1.2,
        dashArray: bucket >= 0 ? null : "3,3",
      };
    }

    let geoLayer = null;
    if (geo) {
      geoLayer = L.geoJSON(geo, {
        interactive: interactive,
        style: (feature) => baseStyleFor(feature.properties.id),
        onEachFeature: (feature, layer) => {
          const pid = feature.properties.id;
          if (opts.onFeatureClick) {
            layer.on("click", () => opts.onFeatureClick(pid, layer, () => layer.setStyle(baseStyleFor(pid))));
          }
          if (interactive) {
            layer.on("mouseover", () => layer.setStyle({ weight: 2.4 }));
            layer.on("mouseout", () => layer.setStyle(baseStyleFor(pid)));
          }
        },
      }).addTo(map);

      try { map.fitBounds(geoLayer.getBounds(), { padding: [12, 12] }); } catch (e) { /* noop */ }
    }

    // CABA no tiene polígono propio en el dataset (queda dentro del contorno
    // de Buenos Aires): se muestra como un punto tocable en su centroide.
    const caba = window.MQD_PROVINCE_BY_ID.caba;
    if (caba && caba.point) {
      const stat = data.byProvince.caba;
      const bucket = bucketFor(stat.count, data.maxCount);
      const fill = bucket >= 0 ? cssVar(RAMP_VARS[bucket]) : emptyFill;
      const marker = L.circleMarker(caba.point, {
        radius: 9,
        fillColor: fill,
        fillOpacity: 0.95,
        color: "#fff",
        weight: 2,
        interactive: interactive,
      }).addTo(map);
      if (opts.onFeatureClick) {
        marker.on("click", () => opts.onFeatureClick("caba", marker, () => marker.setStyle({ weight: 2 })));
      }
      if (interactive) marker.bindTooltip("CABA", { direction: "top", offset: [0, -6] });
    }

    return map;
  }

  return { loadGeoJson, render, renderLegend, bucketFor, cssVar, RAMP_VARS, EMPTY_VAR };
})();

/**
 * Driver de mapa.html: el mapa interactivo completo, con hoja de detalle
 * por distrito (problemas/necesidades/testimonios de cada provincia).
 */
(function () {
  const M = window.MQD_MAP;
  const SITUACION_LABEL = { 1: "Muy mala", 2: "Mala", 3: "Regular", 4: "Buena", 5: "Muy buena" };
  const VISION_LABEL = { "-2": "Muy pesimista", "-1": "Pesimista", "0": "Neutral", "1": "Optimista", "2": "Muy optimista" };

  function fmtAvg(sum, n, labels) {
    if (!n) return "Sin datos aún";
    const avg = Math.round(sum / n);
    return labels[avg] || labels[String(avg)] || "—";
  }

  function buildSheetContent(stat) {
    const top = (obj, n) => window.MQD_sortedEntries(obj).slice(0, n);
    const problemas = top(stat.problemas, 5);
    const necesidades = top(stat.necesidades, 5);
    const maxP = Math.max(1, ...problemas.map((x) => x[1]));
    const maxN = Math.max(1, ...necesidades.map((x) => x[1]));

    const barList = (entries, max) =>
      entries.length
        ? `<ul class="bar-list">${entries
            .map(
              ([label, val]) => `
              <li class="bar-row">
                <div class="bar-row__top"><span class="label">${label}</span><span class="value">${val}</span></div>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, (val / max) * 100)}%"></div></div>
              </li>`
            )
            .join("")}</ul>`
        : `<p class="empty-note">Todavía no hay respuestas suficientes para este distrito.</p>`;

    const quotes = stat.quotes.slice(0, 3);
    const quotesHtml = quotes.length
      ? quotes
          .map(
            (q) => `<blockquote class="testimonio">"${q.text}"${q.localidad ? `<footer>— ${q.localidad}</footer>` : ""}</blockquote>`
          )
          .join("")
      : "";

    return `
      <span class="region-tag">Región ${stat.region}</span>
      <h3>${stat.name}</h3>
      <div class="stat-row" style="margin: 14px 0 18px;">
        <div class="stat"><b>${stat.count}</b><span>Encuestados</span></div>
        <div class="stat"><b class="stat-text">${fmtAvg(stat.situacionSum, stat.situacionN, SITUACION_LABEL)}</b><span>Situación</span></div>
        <div class="stat"><b class="stat-text">${fmtAvg(stat.visionSum, stat.visionN, VISION_LABEL)}</b><span>Visión país</span></div>
      </div>
      ${stat.localidades.size ? `<p class="small muted">Localidades: ${Array.from(stat.localidades).slice(0, 8).join(" · ")}</p>` : ""}
      <h4 style="margin-top:18px;">Problemas más mencionados</h4>
      ${barList(problemas, maxP)}
      <h4 style="margin-top:18px;">Necesidades más mencionadas</h4>
      ${barList(necesidades, maxN)}
      ${quotesHtml ? `<h4 style="margin-top:18px;">En sus palabras</h4>${quotesHtml}` : ""}
    `;
  }

  function initSheet(data) {
    const backdrop = document.getElementById("sheetBackdrop");
    const sheet = document.getElementById("sheet");
    const body = document.getElementById("sheetBody");
    let resetSelection = null;

    function open(provinceId, onSelect) {
      const stat = data.byProvince[provinceId];
      if (!stat) return;
      body.innerHTML = buildSheetContent(stat);
      backdrop.classList.add("is-open");
      sheet.classList.add("is-open");
      document.body.style.overflow = "hidden";
      if (resetSelection) resetSelection();
      resetSelection = onSelect ? onSelect() : null;
    }
    function close() {
      backdrop.classList.remove("is-open");
      sheet.classList.remove("is-open");
      document.body.style.overflow = "";
      if (resetSelection) { resetSelection(); resetSelection = null; }
    }

    backdrop.addEventListener("click", close);
    document.getElementById("sheetClose").addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    return { open, close };
  }

  async function init() {
    const mapEl = document.getElementById("mapCanvas");
    if (!mapEl) return; // esta página no tiene el mapa completo (ej. síntesis)
    const legend = document.getElementById("mapLegend");
    const banner = document.getElementById("dataBanner");
    const statTotal = document.getElementById("statTotal");
    const statProv = document.getElementById("statProv");
    const statLoc = document.getElementById("statLoc");

    M.renderLegend(legend);

    const [geo, data] = await Promise.all([
      M.loadGeoJson().catch((e) => { console.error(e); return null; }),
      window.MQD_DATA.load(),
    ]);

    banner.classList.remove("skeleton");
    if (data.isDemo) {
      banner.classList.add("demo");
      banner.innerHTML = `<span class="dot"></span> Mostrando datos de ejemplo — se reemplazan automáticamente al conectar el backend.`;
    } else if (data.empty) {
      banner.classList.add("demo");
      banner.innerHTML = `<span class="dot"></span> Todavía no llegaron respuestas del formulario.`;
    } else {
      banner.classList.add("live");
      banner.innerHTML = `<span class="dot"></span> Datos en vivo del Encuentro Nacional de Jóvenes FR.`;
    }
    statTotal.textContent = data.totalResponses;
    statProv.textContent = data.totalProvinces;
    statLoc.textContent = data.totalLocalidades;

    const sheet = initSheet(data);
    const navy = M.cssVar("--navy") || "#04537a";

    M.render(mapEl, geo, data, {
      interactive: true,
      onFeatureClick: (pid, layer, resetStyle) => {
        sheet.open(pid, () => {
          layer.setStyle({ weight: 3, color: navy });
          if (layer.bringToFront) layer.bringToFront();
          return resetStyle;
        });
      },
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
