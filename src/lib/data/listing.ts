export const PAGE_SIZE = 50;

export function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function pageRange(page: number) {
  const from = (page - 1) * PAGE_SIZE;
  return { from, to: from + PAGE_SIZE - 1 };
}

/**
 * Texto de búsqueda listo para filtros ilike de PostgREST: minúsculas, sin
 * acentos y solo letras, números y espacios (evita romper la sintaxis de
 * .or() y los comodines).
 */
export function searchTerm(value: string | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ@. ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}
