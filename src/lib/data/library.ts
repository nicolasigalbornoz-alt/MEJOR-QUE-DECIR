import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { pageRange, searchTerm, uuidFilter } from "@/lib/data/listing";

type TagRef = { id: string; name: string; color: string; archived: boolean };

export type LibraryItem = {
  id: string;
  title: string;
  author: string;
  year: number | null;
  description: string;
  storagePath: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  externalUrl: string | null;
  tags: TagRef[];
};

type LibraryRow = {
  id: string;
  title: string;
  author: string;
  year: number | null;
  description: string;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  external_url: string | null;
  library_item_tags: { tags: TagRef | null }[];
};

const COLUMNS = "id,title,author,year,description,storage_path,mime_type,size_bytes,external_url,library_item_tags(tags(id,name,color,archived))";

function toItem(row: LibraryRow): LibraryItem {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    year: row.year,
    description: row.description,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    externalUrl: row.external_url,
    tags: row.library_item_tags.flatMap((item) => (item.tags ? [item.tags] : [])),
  };
}

export type LibraryFilters = { q?: string; tema?: string };

export async function listLibrary(supabase: SupabaseClient, filters: LibraryFilters, page: number) {
  const { from, to } = pageRange(page);
  let ids: string[] | null = null;
  const tema = uuidFilter(filters.tema);
  if (tema) {
    const { data } = await supabase.from("library_item_tags").select("item_id").eq("tag_id", tema);
    ids = (data ?? []).map((row) => row.item_id as string);
    if (!ids.length) return { items: [], total: 0 };
  }
  let query = supabase.from("library_items").select(COLUMNS, { count: "exact" });
  const term = searchTerm(filters.q);
  if (term) query = query.ilike("search_text", `%${term}%`);
  if (ids) query = query.in("id", ids);
  const { data, count, error } = await query.order("title").range(from, to);
  if (error) throw new Error("No se pudo cargar la biblioteca.");
  return { items: ((data ?? []) as unknown as LibraryRow[]).map(toItem), total: count ?? 0 };
}

export async function getLibraryItem(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("library_items").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toItem(data as unknown as LibraryRow) : null;
}
