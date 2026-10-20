import { NextResponse } from "next/server";
import { fileExtension } from "@/features/files/file-types";
import { requireStaff } from "@/lib/auth/require-staff";

export const dynamic = "force-dynamic";

const SOURCES = {
  insumo: { table: "activity_attachments", bucket: "activity-files" },
  formacion: { table: "library_items", bucket: "library" },
} as const;

const SIGNED_URL_SECONDS = 300;

// Descarga de archivos privados del panel: comprueba la sesión y el rol, y
// redirige a una URL firmada de corta duración.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tipo: string; id: string }> },
) {
  const { tipo, id } = await params;
  const source = SOURCES[tipo as keyof typeof SOURCES];
  if (!source || !/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("Archivo no disponible.", { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const { supabase } = await requireStaff();
  const { data } = await supabase.from(source.table).select("title,storage_path").eq("id", id).maybeSingle();
  const path = data?.storage_path as string | null | undefined;
  if (path) {
    const filename = `${String(data?.title ?? "archivo").replace(/[^\p{L}\p{N} ._-]+/gu, "").slice(0, 120) || "archivo"}.${fileExtension(path)}`;
    const { data: signed, error } = await supabase.storage.from(source.bucket).createSignedUrl(path, SIGNED_URL_SECONDS, { download: filename });
    if (!error && signed?.signedUrl) {
      return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    }
  }
  return new NextResponse("Archivo no disponible.", { status: 404, headers: { "Cache-Control": "no-store" } });
}
