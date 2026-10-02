/**
 * Home (index.html) — arma la grilla "Qué preguntamos" como un
 * rompecabezas de 6 piezas fijas (3 filas x 2 columnas) que encajan
 * entre sí, usando el mismo motor que sintesis.html (ver
 * assets/js/puzzle.js). A diferencia de las piezas de comisión, estas
 * son puramente informativas (no llevan datos en vivo ni abren nada al
 * tocarlas), así que van en <div>, no en <button>.
 */
(function () {
  const ICON_UBICACION = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>';
  const ICON_RELOJ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>';
  const ICON_ALERTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>';
  const ICON_MEGAFONO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8 13 20l3-1-1.4-3.2"/></svg>';
  const ICON_VISION = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h4l2-8 4 16 2-8h8"/></svg>';
  const ICON_CALENDARIO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

  // Textos cortos a propósito: la pieza es chica (sobre todo en celular),
  // así que el título ya dice casi todo y la descripción es solo un
  // remate de pocas palabras, no una oración completa.
  const ITEMS = [
    { icon: ICON_UBICACION, title: "De dónde son", desc: "Provincia, ciudad, barrio." },
    { icon: ICON_RELOJ, title: "Situación del distrito", desc: "Cómo ven su lugar." },
    { icon: ICON_ALERTA, title: "Problemas de la juventud", desc: "Lo que enfrentan a diario." },
    { icon: ICON_MEGAFONO, title: "Necesidades", desc: "Qué necesitan para crecer." },
    { icon: ICON_VISION, title: "Visión del país", desc: "Qué tan optimistas son." },
    { icon: ICON_CALENDARIO, title: "19 de septiembre", desc: "Un día, todo el país." },
  ];

  // Grilla fija de 2 filas x 3 columnas (6 piezas) — misma cantidad de
  // columnas que el rompecabezas de comisiones de sintesis.js, para que
  // cada pieza salga más chica y la sección no ocupe tanto alto en
  // celular (con 3 filas de 2 columnas quedaba demasiado grande). Igual
  // que ahí, la cantidad de filas/columnas no puede cambiar según el
  // ancho de pantalla o el encastre entre piezas vecinas dejaría de
  // coincidir (ver assets/js/puzzle.js).
  const ROWS = 2, COLS = 3;
  const JOINT_H = [
    [true, false],
    [false, true],
  ]; // dos empalmes horizontales por fila (3 columnas)
  const JOINT_V = [true, false, true]; // un solo empalme vertical por columna (2 filas)

  const COLOR_VARS = ["--seq-250", "--seq-350", "--seq-450", "--seq-500", "--seq-600", "--seq-700"];

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function buildGrid(el) {
    el.innerHTML = ITEMS.map((item, i) => {
      const r = Math.floor(i / COLS);
      const c = i % COLS;
      const edges = window.MQD_PUZZLE.edgesFor(r, c, ROWS, COLS, (row, j) => JOINT_H[row][j], (col) => JOINT_V[col]);
      const color = cssVar(COLOR_VARS[i % COLOR_VARS.length]);
      return `
        <div class="puzzle-piece puzzle-piece--static">
          ${window.MQD_PUZZLE.svg(color, edges)}
          <span class="puzzle-piece__label">
            <span class="puzzle-piece__icon">${item.icon}</span>
            <b>${item.title}</b>
            <small>${item.desc}</small>
          </span>
        </div>`;
    }).join("");
  }

  function init() {
    const el = document.getElementById("quePreguntamosGrid");
    if (!el) return;
    buildGrid(el);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
