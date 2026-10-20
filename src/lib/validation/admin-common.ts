import { z } from "zod";
import { PROVINCES } from "@/data/provinces";

const provinceIds = PROVINCES.map((province) => province.id) as [string, ...string[]];

/** Texto opcional: recorta espacios y deja "" si viene vacío o ausente. */
export const optionalText = (max: number) => z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().max(max),
);

export const requiredText = (max: number) => z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().min(1).max(max),
);

export const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : ""),
  z.union([z.literal(""), z.string().email().max(254)]),
);

export const optionalProvince = z.preprocess(
  (value) => (typeof value === "string" && value ? value : null),
  z.enum(provinceIds).nullable(),
);

export const uuidList = z.array(z.string().uuid()).max(50);

export function formList(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => (typeof value === "string" ? value : ""));
}
