import { z } from "zod";

export const attachmentSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().uuid().optional(),
    kind: z.literal("file"),
    title: z.string().trim().min(1).max(200),
    storagePath: z.string().max(500),
    mimeType: z.string().max(120),
    sizeBytes: z.number().int().min(1),
  }),
  z.object({
    id: z.string().uuid().optional(),
    kind: z.literal("link"),
    title: z.string().trim().min(1).max(200),
    url: z.string().trim().max(2000).regex(/^https?:\/\/\S+$/i),
  }),
]);

export type AttachmentInput = z.infer<typeof attachmentSchema>;

export function parseAttachments(value: FormDataEntryValue | null) {
  try {
    return z.array(attachmentSchema).max(30).safeParse(JSON.parse(typeof value === "string" && value ? value : "[]"));
  } catch {
    return z.array(attachmentSchema).safeParse(null);
  }
}
