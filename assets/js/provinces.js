/**
 * Distritos federales (23 provincias + CABA) y su posición en el
 * cartograma de teselas (grilla 6 columnas), aproximando su ubicación
 * geográfica real para que el mapa se "lea" como la Argentina.
 *
 * col crece de oeste a este. row crece de norte a sur.
 */
window.MQD_PROVINCES = [
  { id: "jujuy",        name: "Jujuy",                region: "NOA",       col: 3, row: 1 },
  { id: "salta",         name: "Salta",                 region: "NOA",       col: 3, row: 2 },
  { id: "formosa",       name: "Formosa",               region: "NEA",       col: 5, row: 2 },
  { id: "catamarca",     name: "Catamarca",             region: "NOA",       col: 2, row: 3 },
  { id: "tucuman",       name: "Tucumán",               region: "NOA",       col: 3, row: 3 },
  { id: "santiago",      name: "Santiago del Estero",   region: "NOA",       col: 4, row: 3 },
  { id: "chaco",         name: "Chaco",                 region: "NEA",       col: 5, row: 3 },
  { id: "misiones",      name: "Misiones",              region: "NEA",       col: 6, row: 3 },
  { id: "rioja",         name: "La Rioja",              region: "Cuyo",      col: 2, row: 4 },
  { id: "corrientes",    name: "Corrientes",            region: "NEA",       col: 5, row: 4 },
  { id: "sanjuan",       name: "San Juan",              region: "Cuyo",      col: 1, row: 5 },
  { id: "cordoba",       name: "Córdoba",               region: "Centro",    col: 3, row: 5 },
  { id: "santafe",       name: "Santa Fe",              region: "Centro",    col: 4, row: 5 },
  { id: "entrerios",     name: "Entre Ríos",            region: "Centro",    col: 5, row: 5 },
  { id: "mendoza",       name: "Mendoza",               region: "Cuyo",      col: 1, row: 6 },
  { id: "sanluis",       name: "San Luis",              region: "Cuyo",      col: 2, row: 6 },
  { id: "pampa",         name: "La Pampa",              region: "Centro",    col: 2, row: 7 },
  { id: "caba",          name: "CABA",                  region: "Centro",    col: 6, row: 7 },
  { id: "buenosaires",   name: "Buenos Aires",          region: "Centro",    col: 4, row: 7, colSpan: 2, rowSpan: 2 },
  { id: "neuquen",       name: "Neuquén",               region: "Patagonia", col: 1, row: 8 },
  { id: "rionegro",      name: "Río Negro",             region: "Patagonia", col: 2, row: 8 },
  { id: "chubut",        name: "Chubut",                region: "Patagonia", col: 1, row: 9, colSpan: 3 },
  { id: "santacruz",     name: "Santa Cruz",            region: "Patagonia", col: 1, row: 10, colSpan: 3 },
  { id: "tierradelfuego",name: "Tierra del Fuego",      region: "Patagonia", col: 2, row: 11 },
];

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
