import { z } from "zod";
import { formList, optionalText, requiredText, uuidList } from "@/lib/validation/admin-common";
import { parseAttachments } from "@/lib/validation/attachments";

export const libraryItemSchema = z.object({
  title: requiredText(250),
  author: optionalText(200),
  year: z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? Number(value) : null),
    z.number().int().min(1500).max(2100).nullable(),
  ),
  description: optionalText(4000),
  tagIds: uuidList,
});

export function parseLibraryForm(formData: FormData) {
  const item = libraryItemSchema.safeParse({
    title: formData.get("title"),
    author: formData.get("author"),
    year: formData.get("year"),
    description: formData.get("description"),
    tagIds: [...new Set(formList(formData, "tagIds"))],
  });
  // Un ítem tiene exactamente una fuente: archivo subido o link.
  const sources = parseAttachments(formData.get("source"));
  const source = sources.success && sources.data.length === 1 ? sources.data[0] : null;
  return { item, source };
}
