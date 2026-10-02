"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

const formSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),
  intro: z.string().trim().max(12000),
  eventId: z.string().uuid().optional().or(z.literal("")),
});

const questionTypes = z.enum([
  "text", "textarea", "single_choice", "multi_choice", "scale", "province", "locality", "participant_lookup",
]);

function parseOptions(value: FormDataEntryValue | null) {
  const lines = String(value ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.map((line) => {
    const separator = line.indexOf("|");
    const label = (separator < 0 ? line : line.slice(separator + 1)).trim();
    const optionValue = (separator < 0 ? line : line.slice(0, separator)).trim();
    return { value: optionValue, label };
  });
}

export async function createForm(formData: FormData) {
  const parsed = formSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    intro: formData.get("intro") ?? "",
    eventId: formData.get("eventId") ?? "",
  });
  if (!parsed.success) redirect("/admin/forms?error=invalid");

  const { supabase } = await requireAdmin();
  const { data: form, error } = await supabase.from("forms").insert({
    title: parsed.data.title,
    slug: parsed.data.slug,
    intro: parsed.data.intro,
    event_id: parsed.data.eventId || null,
    status: "draft",
  }).select("id").single();
  if (error || !form) redirect(`/admin/forms?error=${error?.code === "23505" ? "slug" : "save"}`);

  const { error: versionError } = await supabase.from("form_versions").insert({
    form_id: form.id,
    version_number: 1,
    status: "draft",
  });
  if (versionError) {
    await supabase.from("forms").delete().eq("id", form.id);
    redirect("/admin/forms?error=save");
  }

  revalidatePath("/admin/forms");
  redirect(`/admin/forms/${form.id}`);
}

export async function updateForm(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("formId"));
  const parsed = formSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    intro: formData.get("intro") ?? "",
    eventId: formData.get("eventId") ?? "",
  });
  if (!id.success || !parsed.success) redirect("/admin/forms?error=invalid");

  const { supabase } = await requireAdmin();
  const { data: current } = await supabase.from("forms").select("slug").eq("id", id.data).maybeSingle();
  const { data: published } = await supabase.from("form_versions").select("id").eq("form_id", id.data).eq("status", "published").limit(1);
  if (current && published?.length && current.slug !== parsed.data.slug) {
    redirect(`/admin/forms/${id.data}?error=slug-locked`);
  }
  const { error } = await supabase.from("forms").update({
    title: parsed.data.title,
    slug: parsed.data.slug,
    intro: parsed.data.intro,
    event_id: parsed.data.eventId || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id.data);
  if (error) redirect(`/admin/forms/${id.data}?error=save`);
  revalidatePath("/admin/forms");
  revalidatePath(`/admin/forms/${id.data}`);
  redirect(`/admin/forms/${id.data}?saved=1`);
}

export async function updateDraftQuestion(formData: FormData) {
  const questionId = z.string().uuid().safeParse(formData.get("questionId"));
  const formId = z.string().uuid().safeParse(formData.get("formId"));
  const label = z.string().trim().min(1).max(500).safeParse(formData.get("label"));
  const helpText = z.string().trim().max(1000).safeParse(formData.get("helpText") ?? "");
  if (!questionId.success || !formId.success || !label.success || !helpText.success) redirect(`/admin/forms/${String(formData.get("formId"))}?error=invalid`);

  const { supabase } = await requireAdmin();
  const { data: question } = await supabase.from("form_questions").select("id,version_id,question_type").eq("id", questionId.data).maybeSingle();
  const { data: version } = question
    ? await supabase.from("form_versions").select("status").eq("id", question.version_id).maybeSingle()
    : { data: null };
  if (!question || version?.status !== "draft") redirect(`/admin/forms/${formId.data}?error=published`);

  const questionOptions = ["single_choice", "multi_choice"].includes(question.question_type)
    ? parseOptions(formData.get("options"))
    : [];
  if (["single_choice", "multi_choice"].includes(question.question_type) && (questionOptions.length < 2 || questionOptions.length > 100)) {
    redirect(`/admin/forms/${formId.data}?error=options`);
  }

  const { error } = await supabase.from("form_questions").update({
    label: label.data,
    help_text: helpText.data,
    required: formData.get("required") === "on",
  }).eq("id", question.id);
  if (error) redirect(`/admin/forms/${formId.data}?error=save`);

  if (["single_choice", "multi_choice"].includes(question.question_type)) {
    const { error: deleteError } = await supabase.from("form_question_options").delete().eq("question_id", question.id);
    if (deleteError) redirect(`/admin/forms/${formId.data}?error=options`);
    const { error: insertError } = await supabase.from("form_question_options").insert(questionOptions.map((option, position) => ({ ...option, question_id: question.id, position })));
    if (insertError) redirect(`/admin/forms/${formId.data}?error=options`);
  }

  revalidatePath(`/admin/forms/${formId.data}`);
  redirect(`/admin/forms/${formId.data}?saved=1`);
}

export async function addQuestion(formData: FormData) {
  const versionId = z.string().uuid().safeParse(formData.get("versionId"));
  const key = z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/).safeParse(formData.get("fieldKey"));
  const label = z.string().trim().min(1).max(500).safeParse(formData.get("label"));
  const type = questionTypes.safeParse(formData.get("questionType"));
  const helpText = z.string().trim().max(1000).safeParse(formData.get("helpText") ?? "");
  if (!versionId.success || !key.success || !label.success || !type.success || !helpText.success) {
    redirect("/admin/forms?error=invalid");
  }

  const options = parseOptions(formData.get("options"));
  if (["single_choice", "multi_choice"].includes(type.data) && (options.length < 2 || options.length > 100)) {
    redirect("/admin/forms?error=options");
  }
  if (options.some((option) => !option.value || option.value.length > 300 || !option.label || option.label.length > 500)) {
    redirect("/admin/forms?error=options");
  }

  const { supabase } = await requireAdmin();
  const { data: version } = await supabase.from("form_versions").select("id,status,form_id").eq("id", versionId.data).maybeSingle();
  if (!version || version.status !== "draft") redirect("/admin/forms?error=published");

  const { count } = await supabase.from("form_questions").select("id", { count: "exact", head: true }).eq("version_id", version.id);
  const position = count ?? 0;
  const minimum = Number(formData.get("scaleMin") ?? 1);
  const maximum = Number(formData.get("scaleMax") ?? 5);
  const maxSelections = Number(formData.get("maxSelections") ?? 3);
  if (type.data === "scale" && (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum >= maximum || minimum < -10 || maximum > 100)) {
    redirect("/admin/forms?error=scale");
  }
  if (type.data === "multi_choice" && (!Number.isInteger(maxSelections) || maxSelections < 1 || maxSelections > 20)) {
    redirect("/admin/forms?error=options");
  }
  const config = type.data === "scale"
    ? { min: minimum, max: maximum }
    : type.data === "multi_choice"
      ? { maxSelections }
      : {};

  const { data: question, error } = await supabase.from("form_questions").insert({
    version_id: version.id,
    field_key: key.data,
    label: label.data,
    help_text: helpText.data,
    question_type: type.data,
    position,
    required: formData.get("required") === "on",
    config,
  }).select("id").single();
  if (error || !question) redirect(`/admin/forms/${version.form_id}?error=${error?.code === "23505" ? "question-key" : "save"}`);

  if (options.length) {
    const { error: optionError } = await supabase.from("form_question_options").insert(
      options.map((option, index) => ({ ...option, question_id: question.id, position: index })),
    );
    if (optionError) {
      await supabase.from("form_questions").delete().eq("id", question.id);
      redirect(`/admin/forms/${version.form_id}?error=options`);
    }
  }

  revalidatePath(`/admin/forms/${version.form_id}`);
  redirect(`/admin/forms/${version.form_id}?saved=1`);
}

export async function removeDraftQuestion(formData: FormData) {
  const questionId = z.string().uuid().safeParse(formData.get("questionId"));
  const formId = z.string().uuid().safeParse(formData.get("formId"));
  if (!questionId.success || !formId.success) redirect("/admin/forms?error=invalid");
  const { supabase } = await requireAdmin();
  const { data: question } = await supabase.from("form_questions").select("id,version_id").eq("id", questionId.data).maybeSingle();
  if (!question) redirect(`/admin/forms/${formId.data}?error=save`);
  const { data: version } = await supabase.from("form_versions").select("status").eq("id", question.version_id).maybeSingle();
  if (version?.status !== "draft") redirect(`/admin/forms/${formId.data}?error=published`);
  const { error } = await supabase.from("form_questions").delete().eq("id", questionId.data);
  if (error) redirect(`/admin/forms/${formId.data}?error=save`);
  revalidatePath(`/admin/forms/${formId.data}`);
  redirect(`/admin/forms/${formId.data}?saved=1`);
}

export async function createFormVersion(formData: FormData) {
  const formId = z.string().uuid().safeParse(formData.get("formId"));
  if (!formId.success) redirect("/admin/forms?error=invalid");
  const { supabase } = await requireAdmin();

  const { data: versions } = await supabase.from("form_versions").select("id,version_number,status").eq("form_id", formId.data).order("version_number", { ascending: false });
  const nextNumber = (versions?.[0]?.version_number ?? 0) + 1;
  const currentPublished = versions?.find((version) => version.status === "published");
  const { data: newVersion, error } = await supabase.from("form_versions").insert({
    form_id: formId.data,
    version_number: nextNumber,
    status: "draft",
  }).select("id").single();
  if (error || !newVersion) redirect(`/admin/forms/${formId.data}?error=save`);

  if (currentPublished) {
    const { data: questions } = await supabase.from("form_questions").select("*,form_question_options(value,label,position)").eq("version_id", currentPublished.id).order("position");
    for (const question of questions ?? []) {
      const { data: copy } = await supabase.from("form_questions").insert({
        version_id: newVersion.id,
        field_key: question.field_key,
        label: question.label,
        help_text: question.help_text,
        question_type: question.question_type,
        position: question.position,
        required: question.required,
        config: question.config,
        visible_when: question.visible_when,
      }).select("id").single();
      if (copy && question.form_question_options?.length) {
        const { error: optionsError } = await supabase.from("form_question_options").insert(
          question.form_question_options.map((option: { value: string; label: string; position: number }) => ({
            question_id: copy.id,
            value: option.value,
            label: option.label,
            position: option.position,
          })),
        );
        if (optionsError) {
          await supabase.from("form_versions").delete().eq("id", newVersion.id);
          redirect(`/admin/forms/${formId.data}?error=clone`);
        }
      } else if (!copy) {
        await supabase.from("form_versions").delete().eq("id", newVersion.id);
        redirect(`/admin/forms/${formId.data}?error=clone`);
      }
    }
  }

  revalidatePath(`/admin/forms/${formId.data}`);
  redirect(`/admin/forms/${formId.data}?version=${newVersion.id}`);
}

export async function publishFormVersion(formData: FormData) {
  const versionId = z.string().uuid().safeParse(formData.get("versionId"));
  const formId = z.string().uuid().safeParse(formData.get("formId"));
  if (!versionId.success || !formId.success) redirect("/admin/forms?error=invalid");
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("publish_form_version", { requested_version: versionId.data });
  if (error) redirect(`/admin/forms/${formId.data}?error=publish`);
  revalidatePath("/eventos");
  revalidatePath("/encuesta");
  revalidatePath(`/formularios/mejor-que-decir`);
  revalidatePath(`/admin/forms/${formId.data}`);
  redirect(`/admin/forms/${formId.data}?published=1`);
}
