/**
 * Mapa federal — mapa interactivo real (Leaflet + polígonos de las 23
 * provincias + CABA como punto), sin claves ni servicios de pago.
 * Cada distrito es tocable; el color codifica la cantidad de respuestas
 * (escala secuencial de un solo tono, claro→oscuro).
 */
(function () {
  const RAMP_VARS = ["--seq-150", "--seq-250", "--seq-350", "--seq-450", "--seq-550", "--seq-650"];
  const SITUACION_LABEL = { 1: "Muy mala", 2: "Mala", 3: "Regular", 4: "Buena", 5: "Muy buena" };
  const VISION_LABEL = { "-2": "Muy pesimista", "-1": "Pesimista", "0": "Neutral", "1": "Optimista", "2": "Muy optimista" };
  const GEOJSON_URL = "assets/data/argentina-provincias.geojson";

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  function isDarkMode() {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return true;
    if (t === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function bucketFor(count, maxCount) {
    if (count <= 0) return -1;
    const ratio = maxCount <= 1 ? 1 : (count - 1) / (maxCount - 1);
    return Math.min(RAMP_VARS.length - 1, Math.floor(ratio * RAMP_VARS.length));
  }

  function fmtAvg(sum, n, labels) {
    if (!n) return "Sin datos aún";
    const avg = Math.round(sum / n);
    return labels[avg] || labels[String(avg)] || "—";
  }

  function renderLegend(el) {
    const ramp = RAMP_VARS.map((v) => cssVar(v));
    el.innerHTML = `
      <span>Sin respuestas</span>
      <span class="ramp">${ramp.map((c) => `<span style="background:${c}"></span>`).join("")}</span>
      <span>Más respuestas</span>
    `;
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
        <div class="stat"><b style="font-size:16px">${fmtAvg(stat.situacionSum, stat.situacionN, SITUACION_LABEL)}</b><span>Situación</span></div>
        <div class="stat"><b style="font-size:16px">${fmtAvg(stat.visionSum, stat.visionN, VISION_LABEL)}</b><span>Visión país</span></div>
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

  async function loadGeoJson() {
    const res = await fetch(GEOJSON_URL, { cache: "force-cache" });
    if (!res.ok) throw new Error("No se pudo cargar el mapa (" + res.status + ")");
    return res.json();
  }

  function tileLayerFor(dark) {
    const url = dark
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    return L.tileLayer(url, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 12,
      minZoom: 3,
    });
  }

  async function init() {
    const mapEl = document.getElementById("mapCanvas");
    const legend = document.getElementById("mapLegend");
    const banner = document.getElementById("dataBanner");
    const statTotal = document.getElementById("statTotal");
    const statProv = document.getElementById("statProv");
    const statLoc = document.getElementById("statLoc");

    renderLegend(legend);

    const [geo, data] = await Promise.all([
      loadGeoJson().catch((e) => { console.error(e); return null; }),
      window.MQD_DATA.load(),
    ]);

    banner.classList.remove("skeleton");
    if (data.isDemo) {
      banner.classList.add("demo");
      banner.innerHTML = `<span class="dot"></span> Mostrando datos de ejemplo — se reemplazan automáticamente al conectar el Google Form.`;
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

    const dark = isDarkMode();
    const map = L.map(mapEl, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 3,
      maxZoom: 12,
      worldCopyJump: false,
    }).setView([-38.4, -63.6], 4);

    let tiles = tileLayerFor(dark).addTo(map);
    if (window.matchMedia) {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        map.removeLayer(tiles);
        tiles = tileLayerFor(isDarkMode()).addTo(map);
      });
    }

    const hairline = cssVar("--hairline") || "#e1e0d9";
    const surface2 = cssVar("--surface-2") || "#f3f6f7";
    const navy = cssVar("--navy") || "#04537a";

    let selectedLayer = null;
    function baseStyleFor(provinceId) {
      const stat = data.byProvince[provinceId];
      const bucket = bucketFor(stat.count, data.maxCount);
      const fill = bucket >= 0 ? cssVar(RAMP_VARS[bucket]) : surface2;
      return {
        fillColor: fill,
        fillOpacity: 0.82,
        color: "#fff",
        weight: 1.2,
        dashArray: bucket >= 0 ? null : "3,3",
      };
    }

    function selectLayer(layer, provinceId) {
      layer.setStyle({ weight: 3, color: navy });
      layer.bringToFront();
      return () => layer.setStyle(baseStyleFor(provinceId));
    }

    let geoLayer = null;
    if (geo) {
      geoLayer = L.geoJSON(geo, {
        style: (feature) => baseStyleFor(feature.properties.id),
        onEachFeature: (feature, layer) => {
          const pid = feature.properties.id;
          layer.on("click", () => sheet.open(pid, () => selectLayer(layer, pid)));
          layer.on("mouseover", () => { if (layer !== selectedLayer) layer.setStyle({ weight: 2.4 }); });
          layer.on("mouseout", () => { if (layer !== selectedLayer) layer.setStyle(baseStyleFor(pid)); });
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
      const fill = bucket >= 0 ? cssVar(RAMP_VARS[bucket]) : surface2;
      const marker = L.circleMarker(caba.point, {
        radius: 9,
        fillColor: fill,
        fillOpacity: 0.95,
        color: "#fff",
        weight: 2,
      }).addTo(map);
      marker.on("click", () => sheet.open("caba", () => {
        marker.setStyle({ weight: 2 });
        return () => marker.setStyle({ weight: 2 });
      }));
      marker.bindTooltip("CABA", { direction: "top", offset: [0, -6] });
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
