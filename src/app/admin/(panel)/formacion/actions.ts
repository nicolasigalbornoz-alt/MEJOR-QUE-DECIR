"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FILE_RULES, isValidStoragePath } from "@/features/files/file-types";
import { requireStaff } from "@/lib/auth/require-staff";
import { parseLibraryForm } from "@/lib/validation/library";

const BUCKET = "library";

export async function saveLibraryItem(formData: FormData) {
  const idValue = formData.get("id");
  const id = typeof idValue === "string" && idValue ? z.string().uuid().safeParse(idValue) : null;
  if (id && !id.success) redirect("/admin/formacion?error=invalid");
  const fail = (code: string): never => redirect(id?.success
    ? `/admin/formacion/${id.data}?editar=1&error=${code}`
    : `/admin/formacion/nuevo?error=${code}`);

  const { item, source } = parseLibraryForm(formData);
  if (!item.success) return fail("invalid");
  if (!source) return fail("source");

  const { supabase } = await requireStaff("editor");
  const previous = id?.success
    ? (await supabase.from("library_items").select("storage_path").eq("id", id.data).maybeSingle()).data
    : null;
  const keepsFile = source.kind === "file" && source.storagePath === previous?.storage_path;

  if (source.kind === "file" && !keepsFile) {
    if (!isValidStoragePath(BUCKET, source.storagePath, source.mimeType) || source.sizeBytes > FILE_RULES[BUCKET].maxBytes) {
      fail("source");
    }
    const { error } = await supabase.storage.from(BUCKET).createSignedUrl(source.storagePath, 30);
    if (error) fail("source");
  }

  const record: Record<string, string | number | null> = {
    title: item.data.title,
    author: item.data.author,
    year: item.data.year,
    description: item.data.description,
    ...(source.kind === "file"
      ? { storage_path: source.storagePath, mime_type: source.mimeType, size_bytes: source.sizeBytes, external_url: null }
      : { storage_path: null, mime_type: null, size_bytes: null, external_url: source.url }),
  };

  let itemId = id?.success ? id.data : null;
  if (itemId) {
    const { error } = await supabase.from("library_items").update(record).eq("id", itemId);
    if (error) fail("save");
  } else {
    const { data, error } = await supabase.from("library_items").insert(record).select("id").single();
    if (error || !data) return fail("save");
    itemId = data.id as string;
  }

  if (previous?.storage_path && !keepsFile) {
    await supabase.storage.from(BUCKET).remove([previous.storage_path as string]);
  }

  const { error: clearError } = await supabase.from("library_item_tags").delete().eq("item_id", itemId);
  if (clearError) redirect(`/admin/formacion/${itemId}?error=tags`);
  if (item.data.tagIds.length) {
    const { error } = await supabase.from("library_item_tags").insert(item.data.tagIds.map((tagId) => ({ item_id: itemId, tag_id: tagId })));
    if (error) redirect(`/admin/formacion/${itemId}?error=tags`);
  }

  revalidatePath("/admin/formacion");
  redirect(`/admin/formacion/${itemId}?saved=1`);
}

export async function deleteLibraryItem(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/formacion?error=invalid");

  const { supabase } = await requireStaff("admin");
  const { data: item } = await supabase.from("library_items").select("storage_path").eq("id", id.data).maybeSingle();
  const { error } = await supabase.from("library_items").delete().eq("id", id.data);
  if (error) redirect(`/admin/formacion/${id.data}?error=save`);
  if (item?.storage_path) await supabase.storage.from(BUCKET).remove([item.storage_path as string]);
  revalidatePath("/admin/formacion");
  redirect("/admin/formacion?saved=deleted");
}
