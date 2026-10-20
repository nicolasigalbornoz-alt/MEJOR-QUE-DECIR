"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FILE_RULES, isValidStoragePath } from "@/features/files/file-types";
import { requireStaff } from "@/lib/auth/require-staff";
import { parseActivityForm } from "@/lib/validation/activity";

const BUCKET = "activity-files";

export async function saveActivity(formData: FormData) {
  const idValue = formData.get("id");
  const id = typeof idValue === "string" && idValue ? z.string().uuid().safeParse(idValue) : null;
  if (id && !id.success) redirect("/admin/insumos?error=invalid");
  const back = id?.success ? `/admin/insumos/${id.data}` : "/admin/insumos/nuevo";

  const { activity, attachments } = parseActivityForm(formData);
  if (!activity.success) redirect(`${back}?error=invalid`);
  if (!attachments.success) redirect(`${back}?error=attachments`);

  const { supabase } = await requireStaff("editor");

  // Adjuntos nuevos: la ruta tiene que tener el formato generado por el
  // navegador, el tipo admitido y existir en el bucket privado.
  for (const item of attachments.data) {
    if (item.kind !== "file" || item.id) continue;
    if (!isValidStoragePath(BUCKET, item.storagePath, item.mimeType) || item.sizeBytes > FILE_RULES[BUCKET].maxBytes) {
      redirect(`${back}?error=attachments`);
    }
    const { error } = await supabase.storage.from(BUCKET).createSignedUrl(item.storagePath, 30);
    if (error) redirect(`${back}?error=attachments`);
  }

  const record = {
    title: activity.data.title,
    description: activity.data.description,
    purpose: activity.data.purpose,
    procedure: activity.data.procedure,
  };

  let activityId = id?.success ? id.data : null;
  if (activityId) {
    const { error } = await supabase.from("activities").update(record).eq("id", activityId);
    if (error) redirect(`${back}?error=save`);
  } else {
    const { data, error } = await supabase.from("activities").insert(record).select("id").single();
    if (error || !data) redirect(`${back}?error=save`);
    activityId = data.id as string;
  }
  const detail = `/admin/insumos/${activityId}`;

  // Tags y personas se reemplazan completos.
  const { error: tagsClear } = await supabase.from("activity_tags").delete().eq("activity_id", activityId);
  const { error: peopleClear } = await supabase.from("activity_people").delete().eq("activity_id", activityId);
  if (tagsClear || peopleClear) redirect(`${detail}?error=links`);
  if (activity.data.tagIds.length) {
    const { error } = await supabase.from("activity_tags").insert(activity.data.tagIds.map((tagId) => ({ activity_id: activityId, tag_id: tagId })));
    if (error) redirect(`${detail}?error=links`);
  }
  const people = [
    ...activity.data.militants.map((person) => ({ activity_id: activityId, militant_id: person.id, note: person.note })),
    ...activity.data.contacts.map((person) => ({ activity_id: activityId, contact_id: person.id, note: person.note })),
  ];
  if (people.length) {
    const { error } = await supabase.from("activity_people").insert(people);
    if (error) redirect(`${detail}?error=links`);
  }

  // Adjuntos: se actualizan los que siguen, se agregan los nuevos y se
  // quitan (con su archivo) los que ya no están.
  const { data: existing } = await supabase.from("activity_attachments").select("id,storage_path").eq("activity_id", activityId);
  const keptIds = new Set(attachments.data.flatMap((item) => (item.id ? [item.id] : [])));
  const removed = (existing ?? []).filter((row) => !keptIds.has(row.id as string));
  if (removed.length) {
    const { error } = await supabase.from("activity_attachments").delete().in("id", removed.map((row) => row.id));
    if (error) redirect(`${detail}?error=attachments`);
    const paths = removed.flatMap((row) => (row.storage_path ? [row.storage_path as string] : []));
    if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  }
  const existingIds = new Set((existing ?? []).map((row) => row.id as string));
  for (const [position, item] of attachments.data.entries()) {
    if (item.id) {
      if (!existingIds.has(item.id)) continue;
      await supabase.from("activity_attachments").update({ title: item.title, position }).eq("id", item.id).eq("activity_id", activityId);
      continue;
    }
    const row: Record<string, string | number | null> = item.kind === "file"
      ? { activity_id: activityId, kind: "file", title: item.title, storage_path: item.storagePath, mime_type: item.mimeType, size_bytes: item.sizeBytes, position }
      : { activity_id: activityId, kind: "link", title: item.title, url: item.url, position };
    const { error } = await supabase.from("activity_attachments").insert(row);
    if (error) redirect(`${detail}?error=attachments`);
  }

  revalidatePath("/admin/insumos");
  redirect(`${detail}?saved=1`);
}

export async function deleteActivity(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) redirect("/admin/insumos?error=invalid");

  const { supabase } = await requireStaff("admin");
  const { data: files } = await supabase.from("activity_attachments").select("storage_path").eq("activity_id", id.data).eq("kind", "file");
  const { error } = await supabase.from("activities").delete().eq("id", id.data);
  if (error) redirect(`/admin/insumos/${id.data}?error=save`);
  const paths = (files ?? []).map((row) => row.storage_path as string).filter(Boolean);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  revalidatePath("/admin/insumos");
  redirect("/admin/insumos?saved=deleted");
}
