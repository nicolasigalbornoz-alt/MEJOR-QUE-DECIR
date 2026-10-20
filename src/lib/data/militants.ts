import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { pageRange, searchTerm } from "@/lib/data/listing";

export type MilitantRole = { id: string; tagId: string; detail: string; tag: { name: string; color: string; archived: boolean } };

export type MilitantSummary = {
  id: string;
  fullName: string;
  provinceId: string | null;
  locality: string;
  phone: string;
  email: string;
  active: boolean;
  roles: MilitantRole[];
};

export type Militant = MilitantSummary & { notes: string; source: string; updatedAt: string };

type MilitantRow = {
  id: string;
  full_name: string;
  province_id: string | null;
  locality: string;
  phone: string;
  email: string;
  active: boolean;
  notes?: string;
  source?: string;
  updated_at?: string;
  militant_roles: { id: string; tag_id: string; detail: string; tags: { name: string; color: string; archived: boolean } | null }[];
};

const SUMMARY_COLUMNS = "id,full_name,province_id,locality,phone,email,active,militant_roles(id,tag_id,detail,tags(name,color,archived))";

function toSummary(row: MilitantRow): MilitantSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    provinceId: row.province_id,
    locality: row.locality,
    phone: row.phone,
    email: row.email,
    active: row.active,
    roles: row.militant_roles.map((role) => ({
      id: role.id,
      tagId: role.tag_id,
      detail: role.detail,
      tag: role.tags ?? { name: "—", color: "#898781", archived: true },
    })),
  };
}

export type MilitantFilters = { q?: string; provincia?: string; responsabilidad?: string; inactivos?: string };

export async function listMilitants(supabase: SupabaseClient, filters: MilitantFilters, page: number) {
  const { from, to } = pageRange(page);
  const columns = filters.responsabilidad
    ? SUMMARY_COLUMNS.replace("militant_roles(", "militant_roles!inner(")
    : SUMMARY_COLUMNS;
  let query = supabase.from("militants").select(columns, { count: "exact" });

  const term = searchTerm(filters.q);
  if (term) query = query.ilike("search_text", `%${term}%`);
  if (filters.provincia) query = query.eq("province_id", filters.provincia);
  if (filters.responsabilidad) query = query.eq("militant_roles.tag_id", filters.responsabilidad);
  if (filters.inactivos !== "1") query = query.eq("active", true);

  const { data, count, error } = await query.order("full_name").range(from, to);
  if (error) throw new Error("No se pudieron cargar los compañeros.");

  // Con el filtro !inner, el embed trae solo la responsabilidad filtrada: se
  // recargan todas para mostrarlas completas.
  let rows = (data ?? []) as unknown as MilitantRow[];
  if (filters.responsabilidad && rows.length) {
    const { data: full } = await supabase.from("militants").select(SUMMARY_COLUMNS).in("id", rows.map((row) => row.id)).order("full_name");
    rows = (full ?? []) as unknown as MilitantRow[];
  }
  return { items: rows.map(toSummary), total: count ?? 0 };
}

export async function getMilitant(supabase: SupabaseClient, id: string): Promise<Militant | null> {
  const { data } = await supabase
    .from("militants")
    .select(`${SUMMARY_COLUMNS},notes,source,updated_at`)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as unknown as MilitantRow;
  return { ...toSummary(row), notes: row.notes ?? "", source: row.source ?? "manual", updatedAt: row.updated_at ?? "" };
}

export type MilitantOption = { id: string; label: string };

/** Búsqueda acotada para selectores (referentes, autores de actividades). */
export async function searchMilitantOptions(supabase: SupabaseClient, q: string): Promise<MilitantOption[]> {
  const term = searchTerm(q);
  if (term.length < 2) return [];
  const { data } = await supabase
    .from("militants")
    .select("id,full_name,locality,province_catalog(name)")
    .ilike("normalized_name", `%${term}%`)
    .eq("active", true)
    .order("full_name")
    .limit(10);
  return ((data ?? []) as unknown as { id: string; full_name: string; locality: string; province_catalog: { name: string } | null }[])
    .map((row) => ({
      id: row.id,
      label: [row.full_name, row.locality, row.province_catalog?.name].filter(Boolean).join(" · "),
    }));
}
