/**
 * Distritos federales (23 provincias + CABA).
 *
 * Las 23 provincias se dibujan como polígonos reales sobre el mapa
 * (assets/data/argentina-provincias.geojson). CABA no entra como polígono
 * separado en ese archivo (queda "adentro" del contorno de Buenos Aires),
 * así que se dibuja aparte como un punto en su centroide oficial.
 */
window.MQD_PROVINCES = [
  { id: "jujuy", name: "Jujuy", region: "NOA" },
  { id: "salta", name: "Salta", region: "NOA" },
  { id: "formosa", name: "Formosa", region: "NEA" },
  { id: "catamarca", name: "Catamarca", region: "NOA" },
  { id: "tucuman", name: "Tucumán", region: "NOA" },
  { id: "santiago", name: "Santiago del Estero", region: "NOA" },
  { id: "chaco", name: "Chaco", region: "NEA" },
  { id: "misiones", name: "Misiones", region: "NEA" },
  { id: "rioja", name: "La Rioja", region: "Cuyo" },
  { id: "corrientes", name: "Corrientes", region: "NEA" },
  { id: "sanjuan", name: "San Juan", region: "Cuyo" },
  { id: "cordoba", name: "Córdoba", region: "Centro" },
  { id: "santafe", name: "Santa Fe", region: "Centro" },
  { id: "entrerios", name: "Entre Ríos", region: "Centro" },
  { id: "mendoza", name: "Mendoza", region: "Cuyo" },
  { id: "sanluis", name: "San Luis", region: "Cuyo" },
  { id: "pampa", name: "La Pampa", region: "Centro" },
  { id: "caba", name: "CABA", region: "Centro", point: [-34.6144420654301, -58.4458763250916] },
  { id: "buenosaires", name: "Buenos Aires", region: "Centro" },
  { id: "neuquen", name: "Neuquén", region: "Patagonia" },
  { id: "rionegro", name: "Río Negro", region: "Patagonia" },
  { id: "chubut", name: "Chubut", region: "Patagonia" },
  { id: "santacruz", name: "Santa Cruz", region: "Patagonia" },
  { id: "tierradelfuego", name: "Tierra del Fuego", region: "Patagonia" },
];

window.MQD_PROVINCE_BY_ID = Object.fromEntries(window.MQD_PROVINCES.map((p) => [p.id, p]));

// Normaliza texto para matchear nombres de provincia sin depender de
// tildes, mayúsculas o variantes de escritura ("caba" / "ciudad de buenos aires").
window.MQD_normalize = function (s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
};

window.MQD_matchProvince = function (rawValue) {
  const v = window.MQD_normalize(rawValue);
  if (!v) return null;
  if (v.includes("caba") || v.includes("ciudad autonoma") || v.includes("capital federal")) return "caba";
  let best = null;
  for (const p of window.MQD_PROVINCES) {
    const n = window.MQD_normalize(p.name);
    if (v === n || v.includes(n) || n.includes(v)) { best = p.id; break; }
  }
  return best;
};
