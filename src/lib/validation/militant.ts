import { z } from "zod";
import { formList, optionalEmail, optionalProvince, optionalText, requiredText } from "@/lib/validation/admin-common";

export const militantSchema = z.object({
  fullName: requiredText(200),
  provinceId: optionalProvince,
  locality: optionalText(200),
  phone: optionalText(60),
  email: optionalEmail,
  notes: optionalText(4000),
  active: z.boolean(),
  roles: z.array(z.object({ tagId: z.string().uuid(), detail: z.string().trim().max(200) })).max(30),
});

export type MilitantInput = z.infer<typeof militantSchema>;

export function parseMilitantForm(formData: FormData) {
  const tagIds = formList(formData, "roleTag");
  const details = formList(formData, "roleDetail");
  const roles = tagIds
    .map((tagId, index) => ({ tagId, detail: (details[index] ?? "").trim() }))
    .filter((role) => role.tagId);
  // Sin duplicados exactos (misma etiqueta y mismo detalle).
  const unique = roles.filter((role, index) =>
    roles.findIndex((other) => other.tagId === role.tagId && other.detail.toLowerCase() === role.detail.toLowerCase()) === index);

  return militantSchema.safeParse({
    fullName: formData.get("fullName"),
    provinceId: formData.get("provinceId"),
    locality: formData.get("locality"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    notes: formData.get("notes"),
    active: formData.get("active") === "true",
    roles: unique,
  });
}
