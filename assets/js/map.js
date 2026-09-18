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
          // Se dispara para CADA distrito ya dibujado (no solo al tocarlo)
          // — lo usa el buscador de localidades para poder centrar el mapa
          // en una provincia por nombre, sin que la persona la haya tocado
          // primero.
          if (opts.onFeatureReady) opts.onFeatureReady(pid, layer);
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
      if (opts.onFeatureReady) opts.onFeatureReady("caba", marker);
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

  function slug(s) {
    return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
  }

  // highlightLocalidad: nombre exacto de localidad a resaltar (viene del
  // buscador — ver buildLocalitySearch) para que, al abrir el distrito
  // desde un resultado de búsqueda, se note cuál es la localidad buscada
  // en vez de tener que leer toda la lista.
  function buildSheetContent(stat, highlightLocalidad) {
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

    // Localidades ordenadas de más a menos respuestas, cada una con su id
    // (para poder hacer scroll hasta ella) y resaltada si es la que se
    // buscó.
    const localidadesEntries = Array.from(stat.localidades.entries()).sort((a, b) => b[1] - a[1]);
    const localidadesHtml = localidadesEntries.length
      ? `<div class="locality-chips">${localidadesEntries
          .map(([nombre, count]) => {
            const isTarget = highlightLocalidad && window.MQD_normalize(nombre) === window.MQD_normalize(highlightLocalidad);
            return `<span class="locality-chip${isTarget ? " is-target" : ""}" id="loc-${slug(nombre)}">${nombre} <b>${count}</b></span>`;
          })
          .join("")}</div>`
      : "";

    return `
      <span class="region-tag">Región ${stat.region}</span>
      <h3>${stat.name}</h3>
      <div class="stat-row" style="margin: 14px 0 18px;">
        <div class="stat"><b>${stat.count}</b><span>Encuestados</span></div>
        <div class="stat"><b class="stat-text">${fmtAvg(stat.situacionSum, stat.situacionN, SITUACION_LABEL)}</b><span>Situación</span></div>
        <div class="stat"><b class="stat-text">${fmtAvg(stat.visionSum, stat.visionN, VISION_LABEL)}</b><span>Visión país</span></div>
      </div>
      ${localidadesHtml ? `<h4 style="margin-top:6px;">Localidades</h4>${localidadesHtml}` : ""}
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

    function open(provinceId, onSelect, highlightLocalidad) {
      const stat = data.byProvince[provinceId];
      if (!stat) return;
      body.innerHTML = buildSheetContent(stat, highlightLocalidad);
      backdrop.classList.add("is-open");
      sheet.classList.add("is-open");
      document.body.style.overflow = "hidden";
      if (resetSelection) resetSelection();
      resetSelection = onSelect ? onSelect() : null;
      if (highlightLocalidad) {
        // Deja que el "sheet" termine de entrar antes de hacer scroll
        // hasta la localidad buscada, si no el scroll queda pisado por la
        // animación de apertura.
        setTimeout(() => {
          const target = body.querySelector(".locality-chip.is-target");
          if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 260);
      }
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

  // Índice plano de todas las localidades presentes en los datos, con
  // cuántas respuestas hay desde cada una y a qué provincia pertenecen —
  // arma el desglose por ciudad: "localizar cada localidad presente".
  function buildLocalityIndex(data) {
    const index = [];
    Object.values(data.byProvince).forEach((stat) => {
      stat.localidades.forEach((count, nombre) => {
        index.push({ nombre, count, provinceId: stat.id, provinceName: stat.name });
      });
    });
    index.sort((a, b) => b.count - a.count);
    return index;
  }

  // Buscador de localidades: tipear un nombre de ciudad/barrio y, al
  // elegir un resultado, el mapa se centra en su provincia y se abre el
  // detalle con esa localidad resaltada — así se puede "encontrar" una
  // localidad puntual aunque el mapa en sí pinte por provincia.
  function initLocalitySearch(data, goTo) {
    const wrap = document.getElementById("localitySearch");
    if (!wrap) return;
    const input = wrap.querySelector("input");
    const results = wrap.querySelector(".locality-results");
    const index = buildLocalityIndex(data);

    function render(items) {
      if (!items.length) {
        results.innerHTML = `<p class="empty-note">No encontramos ninguna localidad con ese nombre.</p>`;
        results.hidden = false;
        return;
      }
      results.innerHTML = items
        .slice(0, 8)
        .map(
          (it) => `
        <button type="button" class="locality-result" data-pid="${it.provinceId}" data-nombre="${it.nombre.replace(/"/g, "&quot;")}">
          <span>${it.nombre}</span>
          <span class="muted small">${it.provinceName} · ${it.count}</span>
        </button>`
        )
        .join("");
      results.hidden = false;
    }

    input.addEventListener("input", () => {
      const q = window.MQD_normalize(input.value.trim());
      if (q.length < 2) { results.hidden = true; results.innerHTML = ""; return; }
      render(index.filter((it) => window.MQD_normalize(it.nombre).includes(q)));
    });
    input.addEventListener("focus", () => { if (input.value.trim().length >= 2) results.hidden = false; });

    results.addEventListener("click", (e) => {
      const btn = e.target.closest(".locality-result");
      if (!btn) return;
      goTo(btn.dataset.pid, btn.dataset.nombre);
      results.hidden = true;
      input.value = "";
      input.blur();
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) results.hidden = true;
    });
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
    const layersByProvince = {};

    const mapInstance = M.render(mapEl, geo, data, {
      interactive: true,
      onFeatureClick: (pid, layer, resetStyle) => {
        sheet.open(pid, () => {
          layer.setStyle({ weight: 3, color: navy });
          if (layer.bringToFront) layer.bringToFront();
          return resetStyle;
        });
      },
      onFeatureReady: (pid, layer) => { layersByProvince[pid] = layer; },
    });

    // Ir a una localidad encontrada por el buscador: centra el mapa en su
    // provincia y abre el detalle con esa localidad resaltada. No hay
    // resetStyle "de fábrica" acá (eso solo lo arma render() al hacer
    // clic), así que guardamos el estilo actual del distrito antes de
    // resaltarlo, para poder devolvérselo tal cual al cerrar.
    initLocalitySearch(data, (pid, nombre) => {
      const layer = layersByProvince[pid];
      if (layer) {
        try {
          if (layer.getBounds) mapInstance.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 7 });
          else if (layer.getLatLng) mapInstance.setView(layer.getLatLng(), 6);
        } catch (e) { /* noop */ }
      }
      sheet.open(pid, () => {
        if (!layer || !layer.setStyle || !layer.options) return null;
        const prevStyle = {
          fillColor: layer.options.fillColor, fillOpacity: layer.options.fillOpacity,
          color: layer.options.color, weight: layer.options.weight, dashArray: layer.options.dashArray,
        };
        layer.setStyle({ weight: 3, color: navy });
        if (layer.bringToFront) layer.bringToFront();
        return () => layer.setStyle(prevStyle);
      }, nombre);
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
