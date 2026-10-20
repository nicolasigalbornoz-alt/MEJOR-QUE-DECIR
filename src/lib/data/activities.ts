import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { pageRange, searchTerm, uuidFilter } from "@/lib/data/listing";

type TagRef = { id: string; name: string; color: string; archived: boolean; category: string };

export type ActivityAttachment =
  | { id: string; kind: "file"; title: string; storagePath: string; mimeType: string; sizeBytes: number; position: number }
  | { id: string; kind: "link"; title: string; url: string; position: number };

export type ActivityPerson = { id: string; kind: "militant" | "contact"; refId: string; name: string; note: string };

export type ActivitySummary = { id: string; title: string; description: string; tags: TagRef[]; attachmentCount: number; updatedAt: string };

export type Activity = ActivitySummary & {
  purpose: string;
  procedure: string;
  people: ActivityPerson[];
  attachments: ActivityAttachment[];
};

type ActivityRow = {
  id: string;
  title: string;
  description: string;
  purpose?: string;
  procedure?: string;
  updated_at: string;
  activity_tags: { tags: TagRef | null }[];
  activity_attachments: {
    id: string; kind: "file" | "link"; title: string; storage_path: string | null; mime_type: string | null;
    size_bytes: number | null; url: string | null; position: number;
  }[];
  activity_people?: { id: string; note: string; militant_id: string | null; contact_id: string | null; militants: { full_name: string } | null; contacts: { name: string } | null }[];
};

const SUMMARY = "id,title,description,updated_at,activity_tags(tags(id,name,color,archived,category)),activity_attachments(id,kind,title,storage_path,mime_type,size_bytes,url,position)";
const FULL = `${SUMMARY},purpose,procedure,activity_people(id,note,militant_id,contact_id,militants(full_name),contacts(name))`;

function toSummary(row: ActivityRow): ActivitySummary {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    updatedAt: row.updated_at,
    tags: row.activity_tags.flatMap((item) => (item.tags ? [item.tags] : [])),
    attachmentCount: row.activity_attachments.length,
  };
}

export type ActivityFilters = { q?: string; tag?: string };

export async function listActivities(supabase: SupabaseClient, filters: ActivityFilters, page: number) {
  const { from, to } = pageRange(page);
  let ids: string[] | null = null;
  const tag = uuidFilter(filters.tag);
  if (tag) {
    const { data } = await supabase.from("activity_tags").select("activity_id").eq("tag_id", tag);
    ids = (data ?? []).map((row) => row.activity_id as string);
    if (!ids.length) return { items: [], total: 0 };
  }
  let query = supabase.from("activities").select(SUMMARY, { count: "exact" });
  const term = searchTerm(filters.q);
  if (term) query = query.ilike("search_text", `%${term}%`);
  if (ids) query = query.in("id", ids);
  const { data, count, error } = await query.order("updated_at", { ascending: false }).range(from, to);
  if (error) throw new Error("No se pudieron cargar los insumos.");
  return { items: ((data ?? []) as unknown as ActivityRow[]).map(toSummary), total: count ?? 0 };
}

export async function getActivity(supabase: SupabaseClient, id: string): Promise<Activity | null> {
  const { data } = await supabase.from("activities").select(FULL).eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as unknown as ActivityRow;
  return {
    ...toSummary(row),
    purpose: row.purpose ?? "",
    procedure: row.procedure ?? "",
    people: (row.activity_people ?? []).map((person) => person.militant_id
      ? { id: person.id, kind: "militant" as const, refId: person.militant_id, name: person.militants?.full_name ?? "—", note: person.note }
      : { id: person.id, kind: "contact" as const, refId: person.contact_id!, name: person.contacts?.name ?? "—", note: person.note }),
    attachments: row.activity_attachments
      .sort((a, b) => a.position - b.position)
      .map((item) => item.kind === "file"
        ? { id: item.id, kind: "file" as const, title: item.title, storagePath: item.storage_path!, mimeType: item.mime_type!, sizeBytes: item.size_bytes!, position: item.position }
        : { id: item.id, kind: "link" as const, title: item.title, url: item.url!, position: item.position }),
  };
}
