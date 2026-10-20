import "server-only";

import { redirect } from "next/navigation";
import { getStaffAccess, hasRole, type StaffRole } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";

/**
 * Comprueba sesión y rol mínimo en servidor. Cada página y cada Server Action
 * del panel la llama; RLS vuelve a aplicar la misma regla en la base.
 */
export async function requireStaff(minimum: StaffRole = "viewer") {
  const access = await getStaffAccess();
  if (access.status === "not-configured" || access.status === "unavailable") redirect("/admin/login?error=configuration");
  if (access.status === "unauthenticated") redirect("/admin/login");
  if (access.status !== "staff") redirect("/admin/login?error=unauthorized");
  if (!hasRole(access.role, minimum)) redirect("/admin?error=forbidden");
  return { supabase: await createClient(), access };
}
