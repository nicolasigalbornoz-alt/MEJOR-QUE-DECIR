"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function updateCapacity(formData: FormData) {
  const type = z.enum(["commission", "workshop"]).safeParse(formData.get("type"));
  const id = z.string().min(1).max(100).safeParse(formData.get("id"));
  const capacity = z.coerce.number().int().min(0).max(100000).safeParse(formData.get("capacity"));
  if (!type.success || !id.success || !capacity.success) redirect("/admin/cupos?error=invalid");
  const { supabase } = await requireAdmin();
  const table = type.data === "commission" ? "commissions" : "workshops";
  const { error } = await supabase.from(table).update({ capacity: capacity.data }).eq("id", id.data);
  if (error) redirect("/admin/cupos?error=save");
  revalidatePath("/admin/cupos");
  redirect("/admin/cupos?saved=1");
}
