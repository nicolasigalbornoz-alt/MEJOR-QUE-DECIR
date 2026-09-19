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

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Actas de comisión subidas desde admin.html — no pasan por
  // MQD_DATA.load() (eso es solo para filas de la encuesta), así que se
  // piden acá directo con su propio fetch.
  async function loadActas() {
    const cfg = window.MQD_CONFIG;
    if (!cfg.appsScriptUrl || !cfg.appsScriptUrl.trim()) return [];
    try {
      const url = cfg.appsScriptUrl.trim().replace(/\/$/, "") + "?action=actas";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return [];
      const json = await res.json();
      const rows = Array.isArray(json && json.rows) ? json.rows : [];
      return rows
        .filter((r) => r && r[1] && r[3])
        .map((r) => ({
          comision: (r[1] || "").toString(),
          nombre: (r[2] || "").toString(),
          url: (r[3] || "").toString(),
          resumen: (r[4] || "").toString(),
        }))
        .reverse(); // más recientes primero (se guardan al final de la hoja)
    } catch (e) {
      return [];
    }
  }

  // ---------- Rompecabezas de comisiones ----------
  // Una pieza por comisión (assets/js/comisiones.js), coloreada con la
  // misma escala secuencial que usa el mapa. Cada pieza muestra cuántos
  // eligieron esa comisión; al tocarla se abre el desglose completo
  // (reutilizando la misma hoja deslizable de mapa.html) con el acta de
  // esa comisión embebida, si ya se subió.
  const PUZZLE_COLOR_VARS = ["--seq-250", "--seq-300", "--seq-350", "--seq-400", "--seq-450", "--seq-500", "--seq-550", "--seq-600", "--seq-650"];

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Grilla fija de 3x3 (9 comisiones) para que las piezas realmente
  // ENCAJEN entre sí: cada borde interno de la grilla se decide una sola
  // vez y las dos piezas que lo comparten dibujan el lado complementario
  // (una tab que sobresale, la otra una muesca del mismo tamaño en el
  // mismo lugar) — por eso la cantidad de columnas no puede ser
  // responsive (ver comentario en .puzzle-grid de styles.css), si no la
  // pieza de al lado en pantallas angostas ya no sería la que calculó el
  // encastre.
  //
  // JOINT_H[fila][junta] = true → la pieza de la izquierda de esa junta
  // tiene la tab (la de la derecha, la muesca que la recibe). Dos juntas
  // horizontales por fila (col0-col1, col1-col2). JOINT_V es lo mismo
  // para las juntas verticales, indexadas por columna.
  const JOINT_H = [
    [true, false],
    [false, true],
    [true, false],
  ];
  const JOINT_V = [
    [false, true],
    [true, false],
    [false, true],
  ];

  // Borde exterior de la grilla (fila/columna 0 o 2 hacia afuera) siempre
  // recto — como si esta grilla de comisiones fuera, a su vez, una sola
  // pieza rectangular de un rompecabezas más grande (el del Encuentro).
  // El armado real de cada borde (tab/muesca/recto) lo hace
  // window.MQD_PUZZLE, compartido con la grilla de "Qué preguntamos" de
  // index.html — ver assets/js/puzzle.js.
  function edgesFor(r, c) {
    return window.MQD_PUZZLE.edgesFor(r, c, 3, 3, (row, j) => JOINT_H[row][j], (col, k) => JOINT_V[col][k]);
  }

  function puzzlePieceSvg(color, edges) {
    return window.MQD_PUZZLE.svg(color, edges);
  }

  function buildPuzzleGrid(el, data) {
    const lista = window.MQD_COMISIONES || [];
    el.innerHTML = lista
      .map((nombre, i) => {
        const stat = data.byComision[nombre];
        const count = stat ? stat.count : 0;
        const color = cssVar(PUZZLE_COLOR_VARS[i % PUZZLE_COLOR_VARS.length]);
        const r = Math.floor(i / 3);
        const c = i % 3;
        return `
        <button type="button" class="puzzle-piece" data-comision="${escapeHtml(nombre)}" aria-label="Ver desglose de la comisión ${escapeHtml(nombre)}">
          ${puzzlePieceSvg(color, edgesFor(r, c))}
          <span class="puzzle-piece__label">
            <b>${escapeHtml(nombre)}</b>
            <small${count ? "" : ' class="is-empty"'}>${count ? count + (count === 1 ? " respuesta" : " respuestas") : "Sin datos todavía"}</small>
          </span>
        </button>`;
      })
      .join("");
  }

  // El documento en sí no se enlaza ni se embebe acá — cada comisión sube
  // un resumen corto (ver admin.js/handleActaUpload) pensado justo para
  // esto, así el informe muestra los puntos principales sin mandar a
  // nadie a abrir un Word aparte.
  function actaBlockHtml(actasComision) {
    if (!actasComision.length) {
      return `<h4 style="margin-top:18px;">Acta de la comisión</h4><p class="empty-note">Todavía no se subió el acta de esta comisión.</p>`;
    }
    return `<h4 style="margin-top:18px;">Acta de la comisión</h4>${actasComision
      .map((a) =>
        a.resumen
          ? `<p class="acta-resumen">${escapeHtml(a.resumen)}</p>`
          : `<p class="empty-note">Se subió el acta, pero todavía no tiene un resumen cargado.</p>`
      )
      .join("")}`;
  }

  // ---------- Documento de conclusión ----------
  // A diferencia del resumen por comisión de arriba (uno por acta, tal
  // cual lo carga cada responsable en admin.html), esto es una lectura
  // más editorial: el punto más importante de cada acta completa, puesto
  // en común. No sale de ninguna hoja de cálculo ni se recalcula solo —
  // se redacta a mano a medida que van llegando las actas y se actualiza
  // este archivo cuando corresponda.
  const CONCLUSIONES = [
    {
      comision: "Inteligencia artificial, plataformas y poder: una mirada desde el Sur Global",
      texto: "La discusión trascendió lo técnico: qué funciones humanas —criterio, decisión, vínculos— estamos dispuestos a delegar en la IA, y qué lugar deben conservar la familia, la escuela y el Estado frente a las infancias. El desafío para Argentina es construir soberanía de datos, infraestructura y modelos propios, sin resignar que el progreso tecnológico esté subordinado a la persona y a la justicia social.",
    },
    {
      comision: "Vivienda, hábitat y urbanismo",
      texto: "El costo del alquiler varía drásticamente según el territorio (de $300.000 en la periferia cordobesa a $1.000.000 en CABA), y el acceso al crédito sigue siendo la experiencia de unos pocos. Se propuso articular al Estado con organizaciones como Techo, fortalecer cooperativas de vivienda y planificar las intervenciones a partir del mapa de barrios populares.",
    },
    {
      comision: "Seguridad",
      texto: "La inseguridad no es solo un déficit policial: la reincidencia de menores ligada al narcomenudeo, los tiempos judiciales que no acompañan la urgencia, y la desconfianza que lleva a organizarse por WhatsApp en vez de llamar al 911 muestran un entramado que exige coordinación entre Nación, provincias y municipios, no solo más patrulleros.",
    },
    {
      comision: "Modelo de desarrollo, producción y federalismo",
      texto: "Las provincias mineras (litio, oro, cobre) reciben regalías mínimas y no logran desarrollar proveedores ni ingenieros propios, mientras la falta de inversión portuaria y ferroviaria empuja a los jóvenes del interior a migrar a Buenos Aires por trabajo. El reclamo transversal es una estrategia productiva federal que no dependa solo de la coparticipación.",
    },
    {
      comision: "Salud mental",
      texto: "El malestar juvenil no es un problema privado: se acumula entre desempleo, deserción escolar, adicciones y, en su expresión más extrema, el suicidio adolescente. La comisión pidió proteger los espacios de encuentro comunitario (clubes, comedores, centros culturales) como red de contención que el Estado debe sostener, no solo fortalecer los servicios de salud mental cuando el síntoma ya apareció.",
    },
    {
      comision: "Militancia en el siglo XXI",
      texto: "Lo que más aleja a los jóvenes de la política no es la falta de ganas, sino sentirse usados: la “política de la foto”, el “todavía sos muy joven” y los cargos que llegan sin formación real. La comisión coincidió en que redes y territorio se complementan, pero que sin formar cuadros —no solo militantes— la renovación generacional queda en el discurso.",
    },
    {
      comision: "Soberanía, tierra y defensa",
      texto: "La comisión planteó que la soberanía incluye defender los recursos naturales frente a quienes usurpan territorio nacional, con foco en Malvinas como proyección estratégica al Atlántico Sur y Gran Bretaña como el actor central del conflicto. Se propuso recuperar el concepto peronista de “nación en armas”, invertir en defensa para ganar margen de negociación, y advertir sobre los acuerdos de seguridad de Brasil y Chile con los británicos, que tensionan la idea de patria grande.",
    },
  ];

  function buildConclusionDoc(el) {
    if (!el) return;
    el.innerHTML = CONCLUSIONES.map(
      (c) => `
      <div class="conclusion-item">
        <h4>${escapeHtml(c.comision)}</h4>
        <p>${escapeHtml(c.texto)}</p>
      </div>`
    ).join("");
  }

  function buildComisionSheetContent(nombre, data, actas) {
    const stat = data.byComision[nombre];
    const actasComision = actas.filter((a) => a.comision === nombre);
    const top = (obj, n) => window.MQD_sortedEntries(obj).slice(0, n);

    if (!stat || !stat.count) {
      return `
        <h3>${escapeHtml(nombre)}</h3>
        <p class="empty-note">Todavía nadie eligió esta comisión como su "Comisión de interés" en la encuesta. Esta pieza del rompecabezas se completa sola a medida que lleguen respuestas.</p>
        ${actaBlockHtml(actasComision)}
      `;
    }

    const problemas = top(stat.problemas, 5);
    const necesidades = top(stat.necesidades, 5);
    const maxP = Math.max(1, ...problemas.map((x) => x[1]));
    const maxN = Math.max(1, ...necesidades.map((x) => x[1]));

    const quotesHtml = stat.quotes.length
      ? stat.quotes
          .map(
            (q) => `<blockquote class="testimonio">"${escapeHtml(q.text)}"<footer>— ${q.localidad ? escapeHtml(q.localidad) + ", " : ""}${escapeHtml(q.provincia || "")}</footer></blockquote>`
          )
          .join("")
      : "";

    return `
      <h3>${escapeHtml(nombre)}</h3>
      <div class="stat-row" style="margin: 14px 0 18px;">
        <div class="stat"><b>${stat.count}</b><span>Interesados/as</span></div>
        <div class="stat"><b class="stat-text">${stat.situacionN ? SITUACION_LABEL[Math.round(stat.situacionSum / stat.situacionN)] : "Sin datos"}</b><span>Situación</span></div>
        <div class="stat"><b class="stat-text">${stat.visionN ? VISION_LABEL[String(Math.round(stat.visionSum / stat.visionN))] : "Sin datos"}</b><span>Visión país</span></div>
      </div>
      <h4>Problemas que más mencionan quienes eligieron esta comisión</h4>
      ${barListHtml(problemas, maxP)}
      <h4 style="margin-top:18px;">Necesidades que más mencionan</h4>
      ${barListHtml(necesidades, maxN)}
      ${quotesHtml ? `<h4 style="margin-top:18px;">En sus palabras</h4>${quotesHtml}` : ""}
      ${actaBlockHtml(actasComision)}
    `;
  }

  function initSheet() {
    const backdrop = document.getElementById("sheetBackdrop");
    const sheet = document.getElementById("sheet");
    const body = document.getElementById("sheetBody");

    function open(html) {
      body.innerHTML = html;
      backdrop.classList.add("is-open");
      sheet.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }
    function close() {
      backdrop.classList.remove("is-open");
      sheet.classList.remove("is-open");
      document.body.style.overflow = "";
    }
    backdrop.addEventListener("click", close);
    document.getElementById("sheetClose").addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    return { open, close };
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
        <b>${VISION_LABEL[String(visionAvgKey)]}</b>, aunque la mirada no es uniforme: conviven
        distritos con una mirada más optimista con otros donde predomina el escepticismo.</p>`
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
    // No depende de la encuesta ni de las actas: se muestra apenas carga
    // la página, sin esperar a que responda el backend.
    buildConclusionDoc(document.getElementById("conclusionDoc"));

    const [data, actas] = await Promise.all([window.MQD_DATA.load(), loadActas()]);

    const puzzleGrid = document.getElementById("puzzleGrid");
    buildPuzzleGrid(puzzleGrid, data);
    const sheet = initSheet();
    puzzleGrid.addEventListener("click", (e) => {
      const btn = e.target.closest(".puzzle-piece");
      if (!btn) return;
      sheet.open(buildComisionSheetContent(btn.dataset.comision, data, actas));
    });

    banner.classList.remove("skeleton");
    if (data.isDemo) {
      banner.classList.add("demo");
      banner.innerHTML = `<span class="dot"></span> Documento generado con datos de ejemplo — se actualiza solo al conectar el backend.`;
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
