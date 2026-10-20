import { z } from "zod";
import { formList, optionalEmail, optionalProvince, optionalText, requiredText } from "@/lib/validation/admin-common";

export const contactSchema = z.object({
  name: requiredText(200),
  typeTagId: z.preprocess((value) => (typeof value === "string" && value ? value : null), z.string().uuid().nullable()),
  description: optionalText(4000),
  phone: optionalText(60),
  email: optionalEmail,
  provinceId: optionalProvince,
  locality: optionalText(200),
  notes: optionalText(4000),
  referents: z.array(z.object({ militantId: z.string().uuid(), note: z.string().trim().max(200) })).max(20),
});

export function parseContactForm(formData: FormData) {
  const ids = formList(formData, "referentId");
  const notes = formList(formData, "referentNote");
  const referents = ids
    .map((militantId, index) => ({ militantId, note: (notes[index] ?? "").trim() }))
    .filter((referent, index, all) => all.findIndex((other) => other.militantId === referent.militantId) === index);

  return contactSchema.safeParse({
    name: formData.get("name"),
    typeTagId: formData.get("typeTagId"),
    description: formData.get("description"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    provinceId: formData.get("provinceId"),
    locality: formData.get("locality"),
    notes: formData.get("notes"),
    referents,
  });
}
