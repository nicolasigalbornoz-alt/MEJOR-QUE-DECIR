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

export type InviteState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "sent"; message: string }
  | { status: "link"; message: string; link: string };

const INVITE_ERRORS: Record<string, string> = {
  invalid: "Revisá el correo y el rol.",
  service: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.",
  exists: "Ya existe una cuenta con ese correo. Usá \"Generar enlace\" para darle acceso.",
  "rate-limit": "Supabase alcanzó el límite de mails por hora. Usá \"Generar enlace\" o configurá un SMTP propio.",
  email: "Supabase no acepta ese correo como válido.",
  invite: "No pudimos crear la invitación.",
  save: "La cuenta se creó, pero no pudimos asignarle el rol. Probá de nuevo.",
};

function inviteError(error: { code?: string; status?: number; message?: string } | null) {
  // Solo el código y el estado: el mail invitado no se escribe en los logs.
  console.error("No se pudo invitar al panel", { code: error?.code, status: error?.status, message: error?.message });
  const reason = error?.code === "email_exists" || error?.code === "user_already_exists" ? "exists"
    : error?.code === "over_email_send_rate_limit" || error?.status === 429 ? "rate-limit"
    : error?.code === "email_address_invalid" ? "email"
    : "invite";
  return { status: "error" as const, message: INVITE_ERRORS[reason] };
}

/**
 * Da acceso al panel. Con mode=email, Supabase manda el mail de invitación.
 * Con mode=link no se manda mail: se devuelve un enlace de un solo uso para
 * compartir a mano (evita el límite de envíos de Supabase).
 */
export async function inviteStaff(_previous: InviteState, formData: FormData): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    displayName: formData.get("displayName") ?? "",
    role: formData.get("role"),
  });
  if (!parsed.success) return { status: "error", message: INVITE_ERRORS.invalid };
  const mode = formData.get("mode") === "link" ? "link" : "email";

  const { access } = await requireStaff("admin");
  const service = createServiceClient();
  if (!service) return { status: "error", message: INVITE_ERRORS.service };

  const confirmUrl = `${await siteOrigin()}/admin/auth/confirm`;
  let userId: string;
  let link: string | null = null;

  if (mode === "email") {
    const { data, error } = await service.auth.admin.inviteUserByEmail(parsed.data.email, {
      // La plantilla "Invite user" de Supabase debe enlazar a
      // {{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite (ver supabase/README.md).
      redirectTo: confirmUrl,
      data: { display_name: parsed.data.displayName },
    });
    if (error || !data.user) return inviteError(error);
    userId = data.user.id;
  } else {
    let { data, error } = await service.auth.admin.generateLink({
      type: "invite",
      email: parsed.data.email,
      options: { redirectTo: confirmUrl, data: { display_name: parsed.data.displayName } },
    });
    let type: "invite" | "recovery" = "invite";
    // Si la cuenta ya existe (por ejemplo, por una invitación anterior que no
    // llegó), un enlace de recuperación le permite elegir contraseña.
    if (error?.code === "email_exists" || error?.code === "user_already_exists") {
      ({ data, error } = await service.auth.admin.generateLink({
        type: "recovery",
        email: parsed.data.email,
        options: { redirectTo: confirmUrl },
      }));
      type = "recovery";
    }
    if (error || !data.user || !data.properties?.hashed_token) return inviteError(error);
    userId = data.user.id;
    link = `${confirmUrl}?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=${type}`;
  }

  const { error: memberError } = await service.from("staff_members").upsert({
    user_id: userId,
    role: parsed.data.role,
    display_name: parsed.data.displayName,
    email: parsed.data.email,
    invited_by: access.userId,
  });
  if (memberError) return { status: "error", message: INVITE_ERRORS.save };

  revalidatePath("/admin/usuarios");
  return link
    ? { status: "link", message: "Cuenta lista. Pasale este enlace; sirve una sola vez y vence según la configuración de Supabase (por defecto, en una hora).", link }
    : { status: "sent", message: "Invitación enviada por mail." };
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
