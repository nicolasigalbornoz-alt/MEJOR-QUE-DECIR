export type Province = {
  id: string;
  name: string;
  region: "NOA" | "NEA" | "Centro" | "Cuyo" | "Patagonia";
  point?: [number, number];
};

export const PROVINCES: Province[] = [
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

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchProvince(rawValue: unknown): string | null {
  const value = normalizeText(rawValue);
  if (!value) return null;
  if (value.includes("caba") || value.includes("ciudad autonoma") || value.includes("capital federal")) {
    return "caba";
  }
  return PROVINCES.find((province) => {
    const name = normalizeText(province.name);
    return value === name || value.includes(name) || name.includes(value);
  })?.id ?? null;
}
