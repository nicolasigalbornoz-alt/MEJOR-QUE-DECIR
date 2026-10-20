import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery"];

// Valida el enlace de invitación (o de recuperación) y abre la sesión en
// cookies; después la persona elige su contraseña en /admin/clave.
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const target = new URL("/admin/login?error=link", request.url);

  if (tokenHash && type && ALLOWED_TYPES.includes(type) && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL("/admin/clave", request.url));
  }

  return NextResponse.redirect(target);
}
