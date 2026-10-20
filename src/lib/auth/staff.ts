import "server-only";

import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type StaffRole = "admin" | "editor" | "viewer";

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin",
  editor: "Editor",
  viewer: "Lector",
};

const ROLE_RANK: Record<StaffRole, number> = { viewer: 0, editor: 1, admin: 2 };

export function hasRole(role: StaffRole, minimum: StaffRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export type StaffAccess =
  | { status: "not-configured" }
  | { status: "unauthenticated" }
  | { status: "unauthorized" }
  | { status: "unavailable" }
  | { status: "staff"; userId: string; email: string | null; displayName: string; role: StaffRole };

export async function getStaffAccess(): Promise<StaffAccess> {
  if (!isSupabaseConfigured()) {
    return { status: "not-configured" };
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) {
    return { status: "unauthenticated" };
  }

  const { data: member, error: memberError } = await supabase
    .from("staff_members")
    .select("role,display_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    return { status: "unavailable" };
  }

  if (!member || !["admin", "editor", "viewer"].includes(member.role)) {
    return { status: "unauthorized" };
  }

  const email = claimsData.claims.email;
  return {
    status: "staff",
    userId,
    email: typeof email === "string" ? email : null,
    displayName: member.display_name,
    role: member.role as StaffRole,
  };
}
