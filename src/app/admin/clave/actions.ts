"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/require-staff";

const passwordSchema = z.object({
  password: z.string().min(10).max(256),
  confirm: z.string(),
}).refine((value) => value.password === value.confirm);

export async function setStaffPassword(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) redirect("/admin/clave?error=invalid");

  const { supabase } = await requireStaff();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) redirect("/admin/clave?error=save");
  redirect("/admin");
}
