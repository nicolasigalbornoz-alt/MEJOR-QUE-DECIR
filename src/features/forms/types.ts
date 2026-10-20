export type FormQuestionType =
  | "text"
  | "textarea"
  | "single_choice"
  | "multi_choice"
  | "scale"
  | "province"
  | "locality"
  | "participant_lookup";

export type FormOption = { value: string; label: string; position: number };

export type FormQuestion = {
  id: string;
  field_key: string;
  label: string;
  help_text: string;
  question_type: FormQuestionType;
  position: number;
  required: boolean;
  config: Record<string, unknown>;
  visible_when: { field: string; equals?: string; contains?: string } | null;
  options: FormOption[];
};

export type PublishedForm = {
  id: string;
  event_id: string | null;
  slug: string;
  title: string;
  intro: string;
  version_id: string;
  questions: FormQuestion[];
};

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  starts_at: string | null;
  ends_at?: string | null;
  status: "draft" | "published" | "archived";
};
