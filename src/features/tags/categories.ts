export const TAG_CATEGORIES = {
  responsabilidad: { label: "Responsabilidades", help: "Rol de cada compañero (militante, coordinador/a, responsable…)." },
  tipo_contacto: { label: "Tipos de contacto", help: "Dirigente, institución, organización social, medio…" },
  publico: { label: "Públicos", help: "A quién está orientada una actividad." },
  actividad: { label: "Tags de actividades", help: "Temas o formatos para filtrar los insumos." },
  tema_formacion: { label: "Temas de formación", help: "Para ordenar libros y PDFs." },
} as const;

export type TagCategory = keyof typeof TAG_CATEGORIES;

export const TAG_CATEGORY_KEYS = Object.keys(TAG_CATEGORIES) as TagCategory[];

export type Tag = {
  id: string;
  category: TagCategory;
  name: string;
  color: string;
  position: number;
  archived: boolean;
};

export const DEFAULT_TAG_COLORS = ["#29a6dd", "#04537a", "#0ca30c", "#ec835a", "#d03b3b", "#fab219", "#7a5af8", "#898781"];
