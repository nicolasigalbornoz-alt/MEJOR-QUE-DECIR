import { redirect } from "next/navigation";
import { getAdminAccess } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const access = await getAdminAccess();
  if (access.status === "not-configured") redirect("/admin/login?error=configuration");
  if (access.status === "unauthenticated") redirect("/admin/login");
  if (access.status !== "admin") redirect("/admin/login?error=unauthorized");
  return { supabase: await createClient(), access };
}
