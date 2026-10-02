import "server-only";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type AdminAccess =
  | { status: "not-configured" }
  | { status: "unauthenticated" }
  | { status: "unauthorized" }
  | { status: "unavailable" }
  | { status: "admin"; email: string | null };

export async function getAdminAccess(): Promise<AdminAccess> {
  if (!isSupabaseConfigured()) {
    return { status: "not-configured" };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return { status: "unauthenticated" };
  }

  const { data: adminRecord, error: adminError } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (adminError) {
    return { status: "unavailable" };
  }

  if (!adminRecord) {
    return { status: "unauthorized" };
  }

  const email = claimsData.claims.email;
  return { status: "admin", email: typeof email === "string" ? email : null };
}
