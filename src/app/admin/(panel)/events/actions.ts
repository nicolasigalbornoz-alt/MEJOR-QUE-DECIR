"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/require-staff";
import { toArgentinaTimestamp } from "@/lib/dates";

const optionalLocalDate = z.string().refine((value) => !value || !Number.isNaN(Date.parse(`${value}:00-03:00`)));

const eventSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  description: z.string().trim().max(12000),
  startsAt: optionalLocalDate.optional(),
  endsAt: optionalLocalDate.optional(),
});

export async function createEvent(formData: FormData) {
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
  });
  if (!parsed.success) redirect("/admin/events?error=invalid");

  const { supabase } = await requireStaff("editor");
  const { error } = await supabase.from("events").insert({
    title: parsed.data.title,
    slug: parsed.data.slug,
    description: parsed.data.description,
    starts_at: parsed.data.startsAt ? toArgentinaTimestamp(parsed.data.startsAt) : null,
    ends_at: parsed.data.endsAt ? toArgentinaTimestamp(parsed.data.endsAt) : null,
    status: "draft",
  });
  if (error) redirect(`/admin/events?error=${error.code === "23505" ? "slug" : "save"}`);

  revalidatePath("/admin/events");
  revalidatePath("/eventos");
  redirect("/admin/events?saved=1");
}

export async function updateEvent(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("eventId"));
  const parsed = eventSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    startsAt: formData.get("startsAt") ?? "",
    endsAt: formData.get("endsAt") ?? "",
  });
  if (!id.success || !parsed.success) redirect("/admin/events?error=invalid");
  const { supabase } = await requireStaff("editor");
  const { error } = await supabase.from("events").update({
    title: parsed.data.title,
    slug: parsed.data.slug,
    description: parsed.data.description,
    starts_at: parsed.data.startsAt ? toArgentinaTimestamp(parsed.data.startsAt) : null,
    ends_at: parsed.data.endsAt ? toArgentinaTimestamp(parsed.data.endsAt) : null,
    updated_at: new Date().toISOString(),
  }).eq("id", id.data);
  if (error) redirect(`/admin/events?error=${error.code === "23505" ? "slug" : "save"}`);
  revalidatePath("/admin/events");
  revalidatePath("/eventos");
  redirect("/admin/events?saved=1");
}

export async function changeEventStatus(formData: FormData) {
  const eventId = z.string().uuid().safeParse(formData.get("eventId"));
  const status = z.enum(["draft", "published", "archived"]).safeParse(formData.get("status"));
  if (!eventId.success || !status.success) redirect("/admin/events?error=invalid");

  const { supabase } = await requireStaff("editor");
  const { error } = await supabase.from("events").update({ status: status.data, updated_at: new Date().toISOString() }).eq("id", eventId.data);
  if (error) redirect("/admin/events?error=save");
  revalidatePath("/admin/events");
  revalidatePath("/eventos");
  redirect("/admin/events?saved=1");
}
