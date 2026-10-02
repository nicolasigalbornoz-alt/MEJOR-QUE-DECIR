/**
 * Motor genérico de piezas de rompecabezas que ENCAJAN entre sí — lo usan
 * tanto la grilla de comisiones de sintesis.html como la de "Qué
 * preguntamos" de index.html (y cualquier otra grilla de piezas que se
 * agregue después).
 *
 * Arma una grilla de R filas x C columnas donde cada borde interno se
 * decide una sola vez: la pieza de un lado dibuja una tab que sobresale
 * y la del otro lado, en el mismo lugar y tamaño exacto, la muesca que
 * la recibe. El borde exterior de toda la grilla queda recto — como si
 * el bloque entero fuera, a su vez, una sola pieza de un rompecabezas
 * más grande.
 *
 * Como el encastre depende de qué pieza es la vecina real, la cantidad
 * de filas/columnas de cada grilla que use esto tiene que ser FIJA (sin
 * @media que la cambie según el ancho de pantalla) — si no, la pieza de
 * al lado ya no sería la que calculó ese borde. El propio SVG de cada
 * pieza tiene que tener overflow:visible (ver ".puzzle-piece > svg" en
 * styles.css) para que la parte de la tab que sobresale del cuadrado de
 * 100x100 se siga viendo, pisando visualmente la celda vecina (que no
 * debe tener gap, ver .puzzle-grid).
 */
window.MQD_PUZZLE = (function () {
  function path(edges) {
    const seg = (kind, mid1, mid2, corner) => {
      if (kind === "flat") return `L${corner}`;
      const sweep = kind === "tab" ? 1 : 0;
      return `L${mid1} A15,15 0 0,${sweep} ${mid2} L${corner}`;
    };
    return [
      "M0,0",
      seg(edges.top, "35,0", "65,0", "100,0"),
      seg(edges.right, "100,35", "100,65", "100,100"),
      seg(edges.bottom, "65,100", "35,100", "0,100"),
      seg(edges.left, "0,65", "0,35", "0,0"),
      "Z",
    ].join(" ");
  }

  function svg(color, edges) {
    return `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="${path(edges)}" fill="${color}"></path></svg>`;
  }

  // getH(r, j): true si la pieza de la IZQUIERDA del empalme horizontal
  // j de la fila r tiene la tab (la de la derecha recibe la muesca).
  // getV(c, k): true si la pieza de ARRIBA del empalme vertical k de la
  // columna c tiene la tab (la de abajo recibe la muesca). j/k son el
  // índice del empalme (columna c comparte el empalme horizontal j=c con
  // la columna c+1; fila r comparte el empalme vertical k=r con la fila
  // r+1) — quien arma la grilla decide cómo guarda esos booleanos,
  // MQD_PUZZLE solo pide poder consultarlos con (r, c-1) / (c, r-1).
  function edgesFor(r, c, rows, cols, getH, getV) {
    return {
      top: r === 0 ? "flat" : getV(c, r - 1) ? "notch" : "tab",
      bottom: r === rows - 1 ? "flat" : getV(c, r) ? "tab" : "notch",
      left: c === 0 ? "flat" : getH(r, c - 1) ? "notch" : "tab",
      right: c === cols - 1 ? "flat" : getH(r, c) ? "tab" : "notch",
    };
  }

  return { path, svg, edgesFor };
})();
