/**
 * Mapa federal — cartograma de teselas de la Argentina.
 * Cada distrito es una tesela tocable; el color codifica la cantidad de
 * respuestas recibidas (escala secuencial de un solo tono, claro→oscuro).
 */
(function () {
  const RAMP = ["seq-150", "seq-250", "seq-350", "seq-450", "seq-550", "seq-650"];
  const SITUACION_LABEL = { 1: "Muy mala", 2: "Mala", 3: "Regular", 4: "Buena", 5: "Muy buena" };
  const VISION_LABEL = { "-2": "Muy pesimista", "-1": "Pesimista", "0": "Neutral", "1": "Optimista", "2": "Muy optimista" };

  function bucketFor(count, maxCount) {
    if (count <= 0) return -1;
    const ratio = maxCount <= 1 ? 1 : (count - 1) / (maxCount - 1);
    return Math.min(RAMP.length - 1, Math.floor(ratio * RAMP.length));
  }

  function fmtAvg(sum, n, labels) {
    if (!n) return "Sin datos aún";
    const avg = Math.round(sum / n);
    return labels[avg] || labels[String(avg)] || "—";
  }

  function renderLegend(el) {
    el.innerHTML = `
      <span>Sin respuestas</span>
      <span class="ramp">${RAMP.map((s) => `<span style="background:var(--${s})"></span>`).join("")}</span>
      <span>Más respuestas</span>
    `;
  }

  function renderGrid(container, data) {
    container.innerHTML = "";
    const provinces = window.MQD_PROVINCES;
    for (const p of provinces) {
      const stat = data.byProvince[p.id];
      const bucket = bucketFor(stat.count, data.maxCount);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tile";
      btn.style.gridColumn = `${p.col} / span ${p.colSpan || 1}`;
      btn.style.gridRow = `${p.row} / span ${p.rowSpan || 1}`;
      if (bucket >= 0) {
        btn.style.background = `var(--${RAMP[bucket]})`;
        if (bucket >= 3) btn.style.color = "#fff";
      } else {
        btn.style.background = "var(--surface-2)";
        btn.style.borderStyle = "dashed";
        btn.style.color = "var(--text-muted)";
      }
      btn.dataset.province = p.id;
      btn.innerHTML = `${p.name}${stat.count ? `<b>${stat.count}</b>` : ""}`;
      btn.setAttribute("aria-label", `${p.name}: ${stat.count} respuestas`);
      container.appendChild(btn);
    }
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
    const grid = document.getElementById("tileGrid");

    function open(provinceId) {
      const stat = data.byProvince[provinceId];
      body.innerHTML = buildSheetContent(stat);
      backdrop.classList.add("is-open");
      sheet.classList.add("is-open");
      grid.querySelectorAll(".tile").forEach((t) => t.classList.toggle("is-selected", t.dataset.province === provinceId));
      document.body.style.overflow = "hidden";
    }
    function close() {
      backdrop.classList.remove("is-open");
      sheet.classList.remove("is-open");
      grid.querySelectorAll(".tile").forEach((t) => t.classList.remove("is-selected"));
      document.body.style.overflow = "";
    }

    grid.addEventListener("click", (e) => {
      const tile = e.target.closest(".tile");
      if (!tile) return;
      open(tile.dataset.province);
    });
    backdrop.addEventListener("click", close);
    document.getElementById("sheetClose").addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  }

  async function init() {
    const grid = document.getElementById("tileGrid");
    const legend = document.getElementById("mapLegend");
    const banner = document.getElementById("dataBanner");
    const statTotal = document.getElementById("statTotal");
    const statProv = document.getElementById("statProv");
    const statLoc = document.getElementById("statLoc");

    renderLegend(legend);

    const data = await window.MQD_DATA.load();

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

    renderGrid(grid, data);
    initSheet(data);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
