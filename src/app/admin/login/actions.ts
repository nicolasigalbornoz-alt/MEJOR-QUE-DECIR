"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
});

export async function signInAdmin(formData: FormData) {
  const credentials = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!credentials.success) {
    redirect("/admin/login?error=invalid");
  }

  if (!isSupabaseConfigured()) {
    redirect("/admin/login?error=configuration");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);

  if (error) {
    // No exponer errores detallados del proveedor de autenticación.
    redirect("/admin/login?error=invalid");
  }

  redirect("/admin");
}
