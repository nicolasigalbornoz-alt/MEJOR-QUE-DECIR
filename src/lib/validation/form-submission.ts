import { z } from "zod";
import type { FormQuestion, PublishedForm } from "@/features/forms/types";

export const submissionBodySchema = z.object({
  answers: z.record(z.string(), z.unknown()),
});

function visible(question: FormQuestion, answers: Record<string, unknown>) {
  if (!question.visible_when) return true;
  const condition = question.visible_when;
  const value = answers[condition.field];
  if (condition.contains) return Array.isArray(value) && value.includes(condition.contains);
  return String(value ?? "") === condition.equals;
}

export function validateFormSubmission(form: PublishedForm, answers: Record<string, unknown>) {
  for (const question of form.questions) {
    if (!visible(question, answers)) continue;
    const value = answers[question.field_key];
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);

    if (question.required && empty) return `Completá el campo “${question.label}”.`;
    if (empty) continue;

    if (["text", "textarea", "province", "locality", "participant_lookup"].includes(question.question_type)) {
      if (typeof value !== "string" || value.length > 2000) return `El campo “${question.label}” no es válido.`;
    }
    if (question.question_type === "single_choice") {
      if (typeof value !== "string" || !question.options.some((option) => option.value === value)) {
        return `Elegí una opción válida en “${question.label}”.`;
      }
    }
    if (question.question_type === "multi_choice") {
      const maximum = Number(question.config.maxSelections ?? 20);
      if (!Array.isArray(value) || value.length > maximum || value.some((item) =>
        typeof item !== "string" || !question.options.some((option) => option.value === item),
      )) return `Revisá las opciones elegidas en “${question.label}”.`;
    }
    if (question.question_type === "scale") {
      const minimum = Number(question.config.min ?? 0);
      const maximum = Number(question.config.max ?? 10);
      if (typeof value !== "number" || !Number.isInteger(value) || value < minimum || value > maximum) {
        return `La escala de “${question.label}” está fuera del rango permitido.`;
      }
    }
  }

  return null;
}
