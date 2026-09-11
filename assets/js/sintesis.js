/**
 * Documento de síntesis — se genera automáticamente a partir de los datos
 * de la encuesta (reales o de ejemplo). Pensado para leerse en el celular
 * y también para imprimirse / guardarse como PDF (botón "Descargar").
 */
(function () {
  const SITUACION_LABEL = { 1: "muy mala", 2: "mala", 3: "regular", 4: "buena", 5: "muy buena" };
  const VISION_LABEL = { "-2": "muy pesimista", "-1": "pesimista", "0": "neutral", "1": "optimista", "2": "muy optimista" };
  const REGIONS = ["NOA", "NEA", "Centro", "Cuyo", "Patagonia"];

  function barListHtml(entries, max, unit) {
    if (!entries.length) return `<p class="empty-note">Todavía no hay datos suficientes.</p>`;
    return `<ul class="bar-list">${entries
      .map(
        ([label, val]) => `
        <li class="bar-row">
          <div class="bar-row__top"><span class="label">${label}</span><span class="value">${val}${unit || ""}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, (val / max) * 100)}%"></div></div>
        </li>`
      )
      .join("")}</ul>`;
  }

  function pct(n, total) { return total ? Math.round((n / total) * 100) : 0; }

  function renderDiverging(el, nacVision, total) {
    const neg2 = nacVision["-2"] || 0, neg1 = nacVision["-1"] || 0;
    const neutral = nacVision["0"] || 0;
    const pos1 = nacVision["1"] || 0, pos2 = nacVision["2"] || 0;
    const seg = (n) => Math.max(0, pct(n, total));
    el.innerHTML = `
      <div class="diverging-row">
        <div class="diverging-track" role="img" aria-label="Distribución de visión sobre el país">
          <div class="diverging-fill-neg" style="width:${seg(neg2)}%; background:var(--div-warm)"></div>
          <div class="diverging-fill-neg" style="width:${seg(neg1)}%; background:#f2a7a6"></div>
          <div class="diverging-spacer"></div>
          <div class="diverging-fill-pos" style="width:${seg(pos1)}%; background:var(--seq-250)"></div>
          <div class="diverging-fill-pos" style="width:${seg(pos2)}%; background:var(--div-cool)"></div>
        </div>
      </div>
      <div class="tag-row small">
        <span class="tag" style="background:var(--div-warm);color:#fff">Muy pesimista ${seg(neg2)}%</span>
        <span class="tag" style="background:#f2a7a6;color:#7a1f1e">Pesimista ${seg(neg1)}%</span>
        <span class="tag">Neutral ${seg(neutral)}%</span>
        <span class="tag" style="background:var(--seq-250);color:var(--navy-700)">Optimista ${seg(pos1)}%</span>
        <span class="tag" style="background:var(--div-cool);color:#fff">Muy optimista ${seg(pos2)}%</span>
      </div>
    `;
  }

  function dominant(obj) {
    const sorted = window.MQD_sortedEntries(obj);
    return sorted.length ? sorted[0] : null;
  }

  function buildNarrative(data) {
    const cfg = window.MQD_CONFIG;
    const topProblemas = window.MQD_sortedEntries(data.nacProblemas).slice(0, 3).map((e) => e[0]);
    const topNecesidades = window.MQD_sortedEntries(data.nacNecesidades).slice(0, 3).map((e) => e[0]);

    let visionSum = 0, visionN = 0;
    Object.entries(data.nacVision).forEach(([k, v]) => { visionSum += Number(k) * v; visionN += v; });
    const visionAvgKey = visionN ? Math.round(visionSum / visionN) : null;

    let situSum = 0, situN = 0;
    Object.entries(data.nacSituacion).forEach(([k, v]) => { situSum += Number(k) * v; situN += v; });
    const situAvgKey = situN ? Math.round(situSum / situN) : null;

    if (!data.totalResponses) {
      return `<p>Todavía no se cargaron respuestas. Este documento se completa solo a medida que la
      encuesta del ${cfg.eventoFecha} recibe participantes.</p>`;
    }

    const parts = [];
    parts.push(
      `<p>Este documento resume lo que dijeron <b>${data.totalResponses} jóvenes</b> de
      <b>${data.totalProvinces} provincias</b> y <b>${data.totalLocalidades} localidades</b> durante el
      ${cfg.eventoNombre}, el ${cfg.eventoFecha}. Es una síntesis viva: se actualiza automáticamente con
      cada nueva respuesta del formulario.</p>`
    );
    if (topProblemas.length) {
      parts.push(
        `<p>El problema que más se repite entre los y las jóvenes encuestados es
        <b>"${topProblemas[0]}"</b>${topProblemas[1] ? `, seguido de "${topProblemas[1]}"` : ""}${
          topProblemas[2] ? ` y "${topProblemas[2]}"` : ""
        }. Estas urgencias marcan la agenda territorial que la militancia debería priorizar.</p>`
      );
    }
    if (topNecesidades.length) {
      parts.push(
        `<p>A la hora de pedir soluciones, lo que más aparece es <b>"${topNecesidades[0]}"</b>${
          topNecesidades[1] ? `, junto con "${topNecesidades[1]}"` : ""
        }${topNecesidades[2] ? ` y "${topNecesidades[2]}"` : ""}.</p>`
      );
    }
    if (situAvgKey != null) {
      parts.push(
        `<p>En promedio, la situación general del distrito se calificó como <b>${SITUACION_LABEL[situAvgKey]}</b>.</p>`
      );
    }
    if (visionAvgKey != null) {
      parts.push(
        `<p>Respecto al futuro del país, el clima general entre quienes respondieron es
        <b>${VISION_LABEL[String(visionAvgKey)]}</b>. La visión del país no es uniforme: conviven
        distritos con mirada más optimista con otros donde predomina el escepticismo, lo que
        confirma que "mejor que decir" hace falta escuchar antes de proponer.</p>`
      );
    }
    return parts.join("");
  }

  function renderRegions(el, data) {
    const byRegion = {};
    REGIONS.forEach((r) => (byRegion[r] = { count: 0, situSum: 0, situN: 0 }));
    Object.values(data.byProvince).forEach((p) => {
      if (!byRegion[p.region]) return;
      byRegion[p.region].count += p.count;
      byRegion[p.region].situSum += p.situacionSum;
      byRegion[p.region].situN += p.situacionN;
    });
    const max = Math.max(1, ...REGIONS.map((r) => byRegion[r].count));
    el.innerHTML = REGIONS.map((r) => {
      const d = byRegion[r];
      const avg = d.situN ? SITUACION_LABEL[Math.round(d.situSum / d.situN)] : "sin datos";
      return `
        <li class="bar-row">
          <div class="bar-row__top"><span class="label">${r}</span><span class="value">${d.count} · situación ${avg}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, (d.count / max) * 100)}%"></div></div>
        </li>`;
    }).join("");
  }

  async function init() {
    const banner = document.getElementById("dataBanner");
    const data = await window.MQD_DATA.load();

    banner.classList.remove("skeleton");
    if (data.isDemo) {
      banner.classList.add("demo");
      banner.innerHTML = `<span class="dot"></span> Documento generado con datos de ejemplo — se actualiza solo al conectar el Google Form.`;
    } else if (data.empty) {
      banner.classList.add("demo");
      banner.innerHTML = `<span class="dot"></span> Todavía no llegaron respuestas del formulario.`;
    } else {
      banner.classList.add("live");
      banner.innerHTML = `<span class="dot"></span> Documento en vivo, generado con las respuestas reales del encuentro.`;
    }

    document.getElementById("statTotal").textContent = data.totalResponses;
    document.getElementById("statProv").textContent = data.totalProvinces;
    document.getElementById("statLoc").textContent = data.totalLocalidades;

    document.getElementById("narrative").innerHTML = buildNarrative(data);

    const topProblemas = window.MQD_sortedEntries(data.nacProblemas).slice(0, 8);
    const maxProb = Math.max(1, ...topProblemas.map((e) => e[1]));
    document.getElementById("problemasList").innerHTML = barListHtml(topProblemas, maxProb);

    const topNecesidades = window.MQD_sortedEntries(data.nacNecesidades).slice(0, 8);
    const maxNec = Math.max(1, ...topNecesidades.map((e) => e[1]));
    document.getElementById("necesidadesList").innerHTML = barListHtml(topNecesidades, maxNec);

    renderDiverging(document.getElementById("visionDiverging"), data.nacVision, data.totalResponses);
    renderRegions(document.getElementById("regionsList"), data);

    const edadEntries = window.MQD_sortedEntries(data.nacEdad);
    document.getElementById("edadList").innerHTML = edadEntries.length
      ? `<div class="tag-row">${edadEntries.map(([k, v]) => `<span class="tag">${k}: ${v}</span>`).join("")}</div>`
      : `<p class="empty-note">Sin datos.</p>`;

    const participaEntries = window.MQD_sortedEntries(data.nacParticipa);
    document.getElementById("participaList").innerHTML = participaEntries.length
      ? `<div class="tag-row">${participaEntries.map(([k, v]) => `<span class="tag">${k}: ${v}</span>`).join("")}</div>`
      : `<p class="empty-note">Sin datos.</p>`;

    const quotes = [];
    Object.values(data.byProvince).forEach((p) => p.quotes.forEach((q) => quotes.push({ ...q, provincia: p.name })));
    const sample = quotes.sort(() => 0.5 - Math.random()).slice(0, 6);
    document.getElementById("quotesList").innerHTML = sample.length
      ? sample.map((q) => `<blockquote class="testimonio">"${q.text}"<footer>— ${q.localidad ? q.localidad + ", " : ""}${q.provincia}</footer></blockquote>`).join("")
      : `<p class="empty-note">Sin testimonios cargados todavía.</p>`;

    document.getElementById("printBtn").addEventListener("click", () => window.print());
  }

  document.addEventListener("DOMContentLoaded", init);
})();
