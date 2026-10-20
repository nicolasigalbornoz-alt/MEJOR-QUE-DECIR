"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { TAG_CATEGORY_KEYS, type Tag } from "@/features/tags/categories";
import { requireStaff } from "@/lib/auth/require-staff";

const categorySchema = z.enum(TAG_CATEGORY_KEYS as [string, ...string[]]);
const nameSchema = z.string().trim().min(1).max(80);
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

function revalidateTagViews() {
  for (const path of ["/admin/etiquetas", "/admin/companeros", "/admin/contactos", "/admin/insumos", "/admin/formacion"]) {
    revalidatePath(path, "layout");
  }
}

export async function createTag(formData: FormData) {
  const parsed = z.object({ category: categorySchema, name: nameSchema, color: colorSchema }).safeParse({
    category: formData.get("category"),
    name: formData.get("name"),
    color: formData.get("color"),
  });
  if (!parsed.success) redirect("/admin/etiquetas?error=invalid");

  const { supabase } = await requireStaff("editor");
  const { count } = await supabase.from("tags").select("id", { count: "exact", head: true }).eq("category", parsed.data.category);
  const { error } = await supabase.from("tags").insert({ ...parsed.data, position: count ?? 0 });
  if (error) redirect(`/admin/etiquetas?error=${error.code === "23505" ? "duplicate" : "save"}`);
  revalidateTagViews();
  redirect("/admin/etiquetas?saved=1");
}

export async function updateTag(formData: FormData) {
  const parsed = z.object({
    id: z.string().uuid(),
    name: nameSchema,
    color: colorSchema,
    archived: z.enum(["true", "false"]),
  }).safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color"),
    archived: formData.get("archived") ?? "false",
  });
  if (!parsed.success) redirect("/admin/etiquetas?error=invalid");

  const { supabase } = await requireStaff("editor");
  const { error } = await supabase.from("tags").update({
    name: parsed.data.name,
    color: parsed.data.color,
    archived: parsed.data.archived === "true",
  }).eq("id", parsed.data.id);
  if (error) redirect(`/admin/etiquetas?error=${error.code === "23505" ? "duplicate" : "save"}`);
  revalidateTagViews();
  redirect("/admin/etiquetas?saved=1");
}

export async function deleteTag(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/etiquetas?error=invalid");

  const { supabase } = await requireStaff("admin");
  const { error } = await supabase.from("tags").delete().eq("id", id.data);
  // 23503: la etiqueta está en uso; se puede archivar en lugar de borrar.
  if (error) redirect(`/admin/etiquetas?error=${error.code === "23503" ? "in-use" : "save"}`);
  revalidateTagViews();
  redirect("/admin/etiquetas?saved=1");
}

/** Alta rápida desde un selector de etiquetas dentro de otro formulario. */
export async function createTagQuick(category: string, name: string): Promise<{ ok: true; tag: Tag } | { ok: false; error: string }> {
  const parsed = z.object({ category: categorySchema, name: nameSchema }).safeParse({ category, name });
  if (!parsed.success) return { ok: false, error: "Escribí un nombre de hasta 80 caracteres." };

  const { supabase } = await requireStaff("editor");
  const { count } = await supabase.from("tags").select("id", { count: "exact", head: true }).eq("category", parsed.data.category);
  const { data, error } = await supabase.from("tags")
    .insert({ category: parsed.data.category, name: parsed.data.name, position: count ?? 0 })
    .select("id,category,name,color,position,archived")
    .single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "Ya existe una etiqueta con ese nombre." : "No pudimos crear la etiqueta." };
  revalidateTagViews();
  return { ok: true, tag: data as Tag };
}
