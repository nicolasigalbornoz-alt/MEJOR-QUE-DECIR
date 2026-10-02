import { NextResponse } from "next/server";
import { getPublishedForm } from "@/lib/data/forms";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { submissionBodySchema, validateFormSubmission } from "@/lib/validation/form-submission";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 65536) {
    return NextResponse.json({ error: "La respuesta supera el tamaño permitido." }, { status: 413 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "La recepción de respuestas todavía no está configurada." }, { status: 503 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "El envío no tiene un formato válido." }, { status: 400 });
  }

  const parsed = submissionBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "El envío no tiene un formato válido." }, { status: 400 });
  }
  if (Buffer.byteLength(JSON.stringify(parsed.data)) > 65536) {
    return NextResponse.json({ error: "La respuesta supera el tamaño permitido." }, { status: 413 });
  }

  const { slug } = await params;
  const form = await getPublishedForm(slug);
  if (!form || form.version_id.startsWith("00000000-0000-4000-8000-")) {
    return NextResponse.json({ error: "El formulario no está publicado en la base de datos." }, { status: 404 });
  }

  const validationError = validateFormSubmission(form, parsed.data.answers);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_form_response", {
    requested_version: form.version_id,
    response_answers: parsed.data.answers,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Ya registramos una respuesta con este nombre para este formulario." }, { status: 409 });
    }
    if (error.code === "22023") {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("No se pudo guardar una respuesta", error.code);
    return NextResponse.json({ error: "No pudimos guardar tu respuesta. Intentá de nuevo en unos minutos." }, { status: 503 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
