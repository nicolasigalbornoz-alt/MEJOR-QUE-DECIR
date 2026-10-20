import "server-only";

import { COMMISSIONS, NEEDS, PARTICIPATION_OPTIONS, PROBLEMS, SITUATION_OPTIONS, VISION_OPTIONS, WORKSHOPS } from "@/features/forms/catalogs";
import type { FormOption, FormQuestion, PublishedForm } from "@/features/forms/types";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

const FORM_ID = "00000000-0000-4000-8000-000000000002";
const FORM_VERSION_ID = "00000000-0000-4000-8000-000000000003";
const EVENT_ID = "00000000-0000-4000-8000-000000000001";

function options(values: readonly { value: string | number; label: string }[]): FormOption[] {
  return values.map((option, position) => ({ ...option, value: String(option.value), position }));
}

const fallbackQuestions: FormQuestion[] = [
  { id: "name", field_key: "nombre", label: "Nombre y apellido", help_text: "Lo usamos para reconocerte del padrón; no se publica.", question_type: "participant_lookup", position: 0, required: true, config: {}, visible_when: null, options: [] },
  { id: "province", field_key: "provincia", label: "¿De qué provincia sos?", help_text: "", question_type: "province", position: 1, required: true, config: {}, visible_when: null, options: [] },
  { id: "locality", field_key: "localidad", label: "Localidad, ciudad o barrio", help_text: "", question_type: "locality", position: 2, required: true, config: {}, visible_when: null, options: [] },
  { id: "participation", field_key: "participa", label: "¿Participás en algún espacio político o de militancia?", help_text: "", question_type: "single_choice", position: 3, required: true, config: {}, visible_when: null, options: options(PARTICIPATION_OPTIONS) },
  { id: "organization", field_key: "agrupacion", label: "¿Cómo se llama tu espacio o agrupación?", help_text: "", question_type: "text", position: 4, required: true, config: {}, visible_when: { field: "participa", equals: "Sí" }, options: [] },
  { id: "situation", field_key: "situacionEscala", label: "¿Cómo calificarías la situación general de tu distrito hoy?", help_text: "", question_type: "scale", position: 5, required: true, config: { min: 1, max: 5, minLabel: "Muy mala", maxLabel: "Muy buena" }, visible_when: null, options: options(SITUATION_OPTIONS) },
  { id: "situation-text", field_key: "situacionTexto", label: "Contanos brevemente la situación de tu distrito", help_text: "", question_type: "textarea", position: 6, required: true, config: {}, visible_when: null, options: [] },
  { id: "territory-issue", field_key: "problematicaTerritorio", label: "Una problemática específica de tu territorio", help_text: "Opcional.", question_type: "textarea", position: 7, required: false, config: {}, visible_when: null, options: [] },
  { id: "problems", field_key: "problemas", label: "¿Cuáles son los principales problemas de la juventud en tu lugar?", help_text: "Elegí hasta 3.", question_type: "multi_choice", position: 8, required: true, config: { maxSelections: 3 }, visible_when: null, options: options(PROBLEMS) },
  { id: "other-problem", field_key: "problemaOtro", label: "Contanos cuál otro problema", help_text: "", question_type: "text", position: 9, required: false, config: {}, visible_when: { field: "problemas", contains: "otro" }, options: [] },
  { id: "needs", field_key: "necesidades", label: "¿Qué necesitan los y las jóvenes de tu distrito para desarrollarse?", help_text: "Elegí hasta 3.", question_type: "multi_choice", position: 10, required: true, config: { maxSelections: 3 }, visible_when: null, options: options(NEEDS) },
  { id: "commission", field_key: "comision", label: "Comisión de interés", help_text: "Elegí una.", question_type: "single_choice", position: 11, required: true, config: {}, visible_when: null, options: options(COMMISSIONS.map((commission) => ({ value: commission.id, label: commission.name })) ) },
  { id: "commission-comment", field_key: "comisionComentario", label: "¿Qué te gustaría que se trabaje en esa comisión?", help_text: "Opcional.", question_type: "textarea", position: 12, required: false, config: {}, visible_when: null, options: [] },
  { id: "workshop", field_key: "taller", label: "Panel de interés", help_text: "Elegí uno.", question_type: "single_choice", position: 13, required: true, config: {}, visible_when: null, options: options(WORKSHOPS.map((workshop) => ({ value: workshop.id, label: workshop.name })) ) },
  { id: "workshop-comment", field_key: "tallerComentario", label: "¿Qué esperás de ese panel?", help_text: "Opcional.", question_type: "textarea", position: 14, required: false, config: {}, visible_when: null, options: [] },
  { id: "vision", field_key: "visionEscala", label: "¿Qué tan optimista sos sobre el futuro del país?", help_text: "", question_type: "scale", position: 15, required: true, config: { min: -2, max: 2, minLabel: "Muy pesimista", maxLabel: "Muy optimista" }, visible_when: null, options: options(VISION_OPTIONS) },
  { id: "vision-text", field_key: "visionFrase", label: "¿Qué país te gustaría construir?", help_text: "En una frase (opcional).", question_type: "text", position: 16, required: false, config: {}, visible_when: null, options: [] },
];

const fallbackForm: PublishedForm = {
  id: FORM_ID,
  event_id: EVENT_ID,
  slug: "mejor-que-decir",
  title: "MEJOR QUE DECIR",
  intro: "Contanos cómo se ve la realidad desde donde estás. Tu respuesta se suma al mapa federal y al documento de síntesis.",
  version_id: FORM_VERSION_ID,
  questions: fallbackQuestions,
};

export async function getPublishedForm(slug: string): Promise<PublishedForm | null> {
  const supabase = createPublicSupabaseClient();
  if (supabase) {
    const { data: form, error } = await supabase
      .from("forms")
      .select("id,event_id,slug,title,intro")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();

    if (!error && form) {
      const { data: version } = await supabase
        .from("form_versions")
        .select("id")
        .eq("form_id", form.id)
        .eq("status", "published")
        .maybeSingle();

      if (version) {
        const { data: questions } = await supabase
          .from("form_questions")
          .select("id,field_key,label,help_text,question_type,position,required,config,visible_when,form_question_options(value,label,position)")
          .eq("version_id", version.id)
          .order("position");

        if (questions) {
          return {
            id: form.id,
            event_id: form.event_id,
            slug: form.slug,
            title: form.title,
            intro: form.intro,
            version_id: version.id,
            questions: questions.map((question) => ({
              ...question,
              options: (question.form_question_options ?? []).sort((a, b) => a.position - b.position),
            })) as FormQuestion[],
          };
        }
      }
    }
  }

  return slug === fallbackForm.slug ? fallbackForm : null;
}

export async function listPublishedFormsForEvent(eventId: string) {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [fallbackForm];
  const { data, error } = await supabase
    .from("forms")
    .select("id,slug,title,intro,event_id")
    .eq("event_id", eventId)
    .eq("status", "published")
    .order("title");
  if (!error && data) return data;
  return eventId === EVENT_ID ? [fallbackForm] : [];
}
