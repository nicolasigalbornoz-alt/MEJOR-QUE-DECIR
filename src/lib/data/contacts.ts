import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { pageRange, searchTerm, uuidFilter } from "@/lib/data/listing";

type TagRef = { name: string; color: string; archived: boolean } | null;

export type ContactReferent = { militantId: string; name: string; phone: string; note: string };

export type Contact = {
  id: string;
  name: string;
  typeTagId: string | null;
  type: TagRef;
  description: string;
  phone: string;
  email: string;
  provinceId: string | null;
  locality: string;
  notes: string;
  referents: ContactReferent[];
};

type ContactRow = {
  id: string;
  name: string;
  type_tag_id: string | null;
  tags: TagRef;
  description: string;
  phone: string;
  email: string;
  province_id: string | null;
  locality: string;
  notes: string;
  contact_referents: { militant_id: string; note: string; militants: { full_name: string; phone: string } | null }[];
};

const COLUMNS = "id,name,type_tag_id,tags(name,color,archived),description,phone,email,province_id,locality,notes,contact_referents(militant_id,note,militants(full_name,phone))";

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    typeTagId: row.type_tag_id,
    type: row.tags,
    description: row.description,
    phone: row.phone,
    email: row.email,
    provinceId: row.province_id,
    locality: row.locality,
    notes: row.notes,
    referents: row.contact_referents.map((referent) => ({
      militantId: referent.militant_id,
      name: referent.militants?.full_name ?? "—",
      phone: referent.militants?.phone ?? "",
      note: referent.note,
    })),
  };
}

export type ContactFilters = { q?: string; tipo?: string; provincia?: string };

export async function listContacts(supabase: SupabaseClient, filters: ContactFilters, page: number) {
  const { from, to } = pageRange(page);
  let query = supabase.from("contacts").select(COLUMNS, { count: "exact" });
  const term = searchTerm(filters.q);
  if (term) query = query.ilike("search_text", `%${term}%`);
  const tipo = uuidFilter(filters.tipo);
  if (tipo) query = query.eq("type_tag_id", tipo);
  if (filters.provincia) query = query.eq("province_id", filters.provincia);
  const { data, count, error } = await query.order("name").range(from, to);
  if (error) throw new Error("No se pudieron cargar los contactos.");
  return { items: ((data ?? []) as unknown as ContactRow[]).map(toContact), total: count ?? 0 };
}

export async function getContact(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("contacts").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toContact(data as unknown as ContactRow) : null;
}

export async function listContactsKnownBy(supabase: SupabaseClient, militantId: string) {
  const { data } = await supabase
    .from("contact_referents")
    .select("note,contacts(id,name,tags(name,color,archived))")
    .eq("militant_id", militantId);
  return ((data ?? []) as unknown as { note: string; contacts: { id: string; name: string; tags: TagRef } | null }[])
    .filter((row) => row.contacts)
    .map((row) => ({ id: row.contacts!.id, name: row.contacts!.name, type: row.contacts!.tags, note: row.note }));
}

/** Búsqueda acotada para selectores (quienes hicieron una actividad). */
export async function searchContactOptions(supabase: SupabaseClient, q: string) {
  const term = searchTerm(q);
  if (term.length < 2) return [];
  const { data } = await supabase
    .from("contacts")
    .select("id,name,tags(name)")
    .ilike("search_text", `%${term}%`)
    .order("name")
    .limit(10);
  return ((data ?? []) as unknown as { id: string; name: string; tags: { name: string } | null }[])
    .map((row) => ({ id: row.id, label: [row.name, row.tags?.name].filter(Boolean).join(" · ") }));
}
