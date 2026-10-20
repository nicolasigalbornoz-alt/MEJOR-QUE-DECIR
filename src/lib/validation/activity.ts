import { z } from "zod";
import { formList, optionalText, requiredText, uuidList } from "@/lib/validation/admin-common";
import { parseAttachments } from "@/lib/validation/attachments";

const personSchema = z.object({ id: z.string().uuid(), note: z.string().trim().max(200) });

export const activitySchema = z.object({
  title: requiredText(200),
  description: optionalText(6000),
  purpose: optionalText(4000),
  procedure: optionalText(20000),
  tagIds: uuidList,
  militants: z.array(personSchema).max(30),
  contacts: z.array(personSchema).max(30),
});

function people(formData: FormData, prefix: string) {
  const ids = formList(formData, `${prefix}Id`);
  const notes = formList(formData, `${prefix}Note`);
  return ids
    .map((id, index) => ({ id, note: (notes[index] ?? "").trim() }))
    .filter((person, index, all) => all.findIndex((other) => other.id === person.id) === index);
}

export function parseActivityForm(formData: FormData) {
  const activity = activitySchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    purpose: formData.get("purpose"),
    procedure: formData.get("procedure"),
    tagIds: [...new Set(formList(formData, "tagIds"))],
    militants: people(formData, "doerMilitant"),
    contacts: people(formData, "doerContact"),
  });
  const attachments = parseAttachments(formData.get("attachments"));
  return { activity, attachments };
}
