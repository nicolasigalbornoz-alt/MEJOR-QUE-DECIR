"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/require-staff";
import { createServiceClient } from "@/lib/supabase/service";

const roleSchema = z.enum(["admin", "editor", "viewer"]);

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  displayName: z.string().trim().max(120),
  role: roleSchema,
});

async function siteOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  const protocol = list.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function inviteStaff(formData: FormData) {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName") ?? "",
    role: formData.get("role"),
  });
  if (!parsed.success) redirect("/admin/usuarios?error=invalid");

  const { access } = await requireStaff("admin");
  const service = createServiceClient();
  if (!service) redirect("/admin/usuarios?error=service");

  const { data, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email, {
    // La plantilla "Invite user" de Supabase debe enlazar a
    // {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite (ver supabase/README.md).
    redirectTo: `${await siteOrigin()}/admin/auth/confirm`,
    data: { display_name: parsed.data.displayName },
  });
  if (error || !data.user) redirect(`/admin/usuarios?error=${error?.code === "email_exists" ? "exists" : "invite"}`);

  const { error: memberError } = await service.from("staff_members").upsert({
    user_id: data.user.id,
    role: parsed.data.role,
    display_name: parsed.data.displayName,
    email: parsed.data.email,
    invited_by: access.userId,
  });
  if (memberError) redirect("/admin/usuarios?error=save");

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?saved=invited");
}

export async function changeStaffRole(formData: FormData) {
  const userId = z.string().uuid().safeParse(formData.get("userId"));
  const role = roleSchema.safeParse(formData.get("role"));
  if (!userId.success || !role.success) redirect("/admin/usuarios?error=invalid");

  const { supabase } = await requireStaff("admin");
  const { error } = await supabase.from("staff_members")
    .update({ role: role.data, updated_at: new Date().toISOString() })
    .eq("user_id", userId.data);
  if (error) redirect(`/admin/usuarios?error=${error.code === "42501" ? "last-admin" : "save"}`);

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?saved=role");
}

export async function removeStaff(formData: FormData) {
  const userId = z.string().uuid().safeParse(formData.get("userId"));
  if (!userId.success) redirect("/admin/usuarios?error=invalid");

  const { supabase, access } = await requireStaff("admin");
  if (userId.data === access.userId) redirect("/admin/usuarios?error=self");

  // Quitar la fila de staff_members ya revoca el acceso (y el trigger impide
  // dejar el panel sin admins). Después se elimina la cuenta de Auth.
  const { error } = await supabase.from("staff_members").delete().eq("user_id", userId.data);
  if (error) redirect(`/admin/usuarios?error=${error.code === "42501" ? "last-admin" : "save"}`);

  const service = createServiceClient();
  if (service) await service.auth.admin.deleteUser(userId.data);

  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios?saved=removed");
}
