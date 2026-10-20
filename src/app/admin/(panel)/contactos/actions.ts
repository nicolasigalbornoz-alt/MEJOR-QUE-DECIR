"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/require-staff";
import { parseContactForm } from "@/lib/validation/contact";

export async function saveContact(formData: FormData) {
  const idValue = formData.get("id");
  const id = typeof idValue === "string" && idValue ? z.string().uuid().safeParse(idValue) : null;
  if (id && !id.success) redirect("/admin/contactos?error=invalid");
  const back = id?.success ? `/admin/contactos/${id.data}` : "/admin/contactos/nuevo";

  const parsed = parseContactForm(formData);
  if (!parsed.success) redirect(`${back}?error=invalid`);

  const { supabase } = await requireStaff("editor");
  const record = {
    name: parsed.data.name,
    type_tag_id: parsed.data.typeTagId,
    description: parsed.data.description,
    phone: parsed.data.phone,
    email: parsed.data.email,
    province_id: parsed.data.provinceId,
    locality: parsed.data.locality,
    notes: parsed.data.notes,
  };

  let contactId = id?.success ? id.data : null;
  if (contactId) {
    const { error } = await supabase.from("contacts").update(record).eq("id", contactId);
    if (error) redirect(`${back}?error=save`);
  } else {
    const { data, error } = await supabase.from("contacts").insert(record).select("id").single();
    if (error || !data) redirect(`${back}?error=save`);
    contactId = data.id as string;
  }

  const { error: clearError } = await supabase.from("contact_referents").delete().eq("contact_id", contactId);
  if (clearError) redirect(`/admin/contactos/${contactId}?error=referents`);
  if (parsed.data.referents.length) {
    const { error: referentsError } = await supabase.from("contact_referents").insert(
      parsed.data.referents.map((referent) => ({ contact_id: contactId, militant_id: referent.militantId, note: referent.note })),
    );
    if (referentsError) redirect(`/admin/contactos/${contactId}?error=referents`);
  }

  revalidatePath("/admin/contactos");
  redirect(`/admin/contactos/${contactId}?saved=1`);
}

export async function deleteContact(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/contactos?error=invalid");

  const { supabase } = await requireStaff("admin");
  const { error } = await supabase.from("contacts").delete().eq("id", id.data);
  if (error) redirect(`/admin/contactos/${id.data}?error=${error.code === "23503" ? "in-use" : "save"}`);
  revalidatePath("/admin/contactos");
  redirect("/admin/contactos?saved=deleted");
}
