import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Tag, TagCategory } from "@/features/tags/categories";

export async function listTags(
  supabase: SupabaseClient,
  categories?: TagCategory[],
  { includeArchived = false } = {},
): Promise<Tag[]> {
  let query = supabase.from("tags").select("id,category,name,color,position,archived").order("position").order("name");
  if (categories?.length) query = query.in("category", categories);
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query;
  if (error) throw new Error("No se pudieron cargar las etiquetas.");
  return (data ?? []) as Tag[];
}

export function tagsByCategory(tags: Tag[], category: TagCategory) {
  return tags.filter((tag) => tag.category === category);
}
