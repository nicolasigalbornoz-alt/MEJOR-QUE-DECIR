"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/require-staff";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const actMetadataSchema = z.object({
  commissionId: z.string().min(1).max(100),
  summary: z.string().trim().min(1).max(2000),
  storagePath: z.string().min(1).max(500),
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string(),
  fileSizeBytes: z.number().int().min(1).max(MAX_FILE_BYTES),
  documentPublic: z.boolean(),
});

export async function saveCommissionAct(input: unknown) {
  const parsed = actMetadataSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisá el archivo y el resumen (máximo 8 MB y 2.000 caracteres)." };

  const extension = parsed.data.originalFilename.toLowerCase().split(".").pop();
  if (extension !== "doc" && extension !== "docx") return { ok: false as const, error: "El archivo debe ser Word (.doc o .docx)." };
  const expectedType = extension === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/msword";
  if (parsed.data.mimeType !== expectedType || !parsed.data.storagePath.startsWith(`${parsed.data.commissionId}/`)) {
    return { ok: false as const, error: "El archivo no coincide con la comisión seleccionada." };
  }

  const { supabase } = await requireStaff("editor");
  const { data: commission } = await supabase.from("commissions").select("id").eq("id", parsed.data.commissionId).eq("active", true).maybeSingle();
  if (!commission) return { ok: false as const, error: "Elegí una comisión activa." };

  // Confirma que la ruta subida desde el navegador existe y es legible por
  // esta sesión administrativa antes de asociarla al acta.
  const { error: fileError } = await supabase.storage.from("commission-acts").createSignedUrl(parsed.data.storagePath, 60);
  if (fileError) return { ok: false as const, error: "No pudimos verificar el archivo en Storage." };

  const { data: previous } = await supabase.from("commission_acts").select("id,storage_path").eq("commission_id", parsed.data.commissionId).maybeSingle();
  const { error: saveError } = await supabase.from("commission_acts").upsert({
    id: previous?.id,
    commission_id: parsed.data.commissionId,
    summary: parsed.data.summary,
    storage_path: parsed.data.storagePath,
    original_filename: parsed.data.originalFilename,
    mime_type: parsed.data.mimeType,
    file_size_bytes: parsed.data.fileSizeBytes,
    document_public: parsed.data.documentPublic,
    uploaded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "commission_id" });

  if (saveError) return { ok: false as const, error: "No pudimos guardar los datos del acta." };
  if (previous?.storage_path && previous.storage_path !== parsed.data.storagePath) {
    await supabase.storage.from("commission-acts").remove([previous.storage_path]);
  }
  revalidatePath("/admin/actas");
  revalidatePath("/sintesis");
  return { ok: true as const };
}

export async function changeActDocumentVisibility(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("actId"));
  const isPublic = z.enum(["true", "false"]).safeParse(formData.get("documentPublic"));
  if (!id.success || !isPublic.success) redirect("/admin/actas?error=validation");
  const { supabase } = await requireStaff("editor");
  const { error } = await supabase.from("commission_acts").update({
    document_public: isPublic.data === "true",
    updated_at: new Date().toISOString(),
  }).eq("id", id.data);
  if (error) redirect("/admin/actas?error=save");
  revalidatePath("/admin/actas");
  revalidatePath("/sintesis");
  redirect("/admin/actas?saved=1");
}

export async function deleteCommissionAct(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("actId"));
  if (!id.success) redirect("/admin/actas?error=validation");
  const { supabase } = await requireStaff("admin");
  const { data: act } = await supabase.from("commission_acts").select("storage_path").eq("id", id.data).maybeSingle();
  if (!act) redirect("/admin/actas?error=not-found");
  const { error } = await supabase.from("commission_acts").delete().eq("id", id.data);
  if (error) redirect("/admin/actas?error=save");
  await supabase.storage.from("commission-acts").remove([act.storage_path]);
  revalidatePath("/admin/actas");
  revalidatePath("/sintesis");
  redirect("/admin/actas?saved=1");
}
