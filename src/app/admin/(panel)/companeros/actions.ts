"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/require-staff";
import { searchMilitantOptions, type MilitantOption } from "@/lib/data/militants";
import { parseMilitantForm } from "@/lib/validation/militant";

export async function saveMilitant(formData: FormData) {
  const idValue = formData.get("id");
  const id = typeof idValue === "string" && idValue ? z.string().uuid().safeParse(idValue) : null;
  const back = id?.success ? `/admin/companeros/${id.data}` : "/admin/companeros/nuevo";
  if (id && !id.success) redirect("/admin/companeros?error=invalid");

  const parsed = parseMilitantForm(formData);
  if (!parsed.success) redirect(`${back}?error=invalid`);

  const { supabase } = await requireStaff("editor");
  const record = {
    full_name: parsed.data.fullName,
    province_id: parsed.data.provinceId,
    locality: parsed.data.locality,
    phone: parsed.data.phone,
    email: parsed.data.email,
    notes: parsed.data.notes,
    active: parsed.data.active,
  };

  let militantId = id?.success ? id.data : null;
  if (militantId) {
    const { error } = await supabase.from("militants").update(record).eq("id", militantId);
    if (error) redirect(`${back}?error=save`);
  } else {
    const { data, error } = await supabase.from("militants").insert(record).select("id").single();
    if (error || !data) redirect(`${back}?error=save`);
    militantId = data.id as string;
  }

  // Las responsabilidades se reemplazan completas con lo que quedó en el formulario.
  const { error: clearError } = await supabase.from("militant_roles").delete().eq("militant_id", militantId);
  if (clearError) redirect(`/admin/companeros/${militantId}?error=roles`);
  if (parsed.data.roles.length) {
    const { error: rolesError } = await supabase.from("militant_roles").insert(
      parsed.data.roles.map((role) => ({ militant_id: militantId, tag_id: role.tagId, detail: role.detail })),
    );
    if (rolesError) redirect(`/admin/companeros/${militantId}?error=roles`);
  }

  revalidatePath("/admin/companeros");
  redirect(`/admin/companeros/${militantId}?saved=1`);
}

export async function deleteMilitant(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/companeros?error=invalid");

  const { supabase } = await requireStaff("admin");
  const { error } = await supabase.from("militants").delete().eq("id", id.data);
  // 23503: está vinculado como referente de un contacto o autor de una actividad.
  if (error) redirect(`/admin/companeros/${id.data}?error=${error.code === "23503" ? "in-use" : "save"}`);
  revalidatePath("/admin/companeros");
  redirect("/admin/companeros?saved=deleted");
}

/** Usado por los selectores de compañeros en otros formularios. */
export async function findMilitants(query: string): Promise<MilitantOption[]> {
  const { supabase } = await requireStaff();
  return searchMilitantOptions(supabase, String(query ?? ""));
}
