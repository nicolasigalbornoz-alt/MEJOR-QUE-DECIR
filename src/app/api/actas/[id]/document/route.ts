import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const access = await getAdminAccess();
  let storagePath: string | null = null;

  if (access.status === "admin") {
    const supabase = await createClient();
    const { data } = await supabase.from("commission_acts").select("storage_path").eq("id", id).maybeSingle();
    storagePath = data?.storage_path ?? null;
    if (storagePath) {
      const { data: signed, error } = await supabase.storage.from("commission-acts").createSignedUrl(storagePath, 3600);
      if (!error && signed?.signedUrl) return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    }
  } else {
    const supabase = createPublicSupabaseClient();
    if (supabase) {
      const { data } = await supabase.from("published_commission_acts").select("public_document_path").eq("id", id).maybeSingle();
      storagePath = data?.public_document_path ?? null;
      if (storagePath) {
        const { data: signed, error } = await supabase.storage.from("commission-acts").createSignedUrl(storagePath, 3600);
        if (!error && signed?.signedUrl) return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
      }
    }
  }

  return new NextResponse("Documento no disponible.", { status: 404, headers: { "Cache-Control": "no-store" } });
}
