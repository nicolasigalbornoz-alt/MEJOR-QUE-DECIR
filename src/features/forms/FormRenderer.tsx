"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { matchProvince, PROVINCES } from "@/data/provinces";
import type { FormQuestion, PublishedForm } from "@/features/forms/types";

type Answers = Record<string, string | number | string[]>;
type Attendee = { display_name: string; province: string | null; locality: string };

function isVisible(question: FormQuestion, answers: Answers) {
  if (!question.visible_when) return true;
  const condition = question.visible_when;
  const value = answers[condition.field];
  if (condition.contains) return Array.isArray(value) && value.includes(condition.contains);
  return String(value ?? "") === condition.equals;
}

function isEmpty(value: string | number | string[] | undefined) {
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

export function FormRenderer({ form }: { form: PublishedForm }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success" | "">("");
  const [pending, setPending] = useState(false);
  const [suggestions, setSuggestions] = useState<Attendee[]>([]);
  const [searching, setSearching] = useState(false);

  const name = String(answers.nombre ?? "");
  const nameQuestion = form.questions.find((question) => question.field_key === "nombre");
  const eventId = form.event_id;

  useEffect(() => {
    const query = name.trim();
    if (!eventId || query.length < 3 || !nameQuestion) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ eventId, q: query });
        const response = await fetch(`/api/attendees?${params}`, { signal: controller.signal });
        if (response.ok) setSuggestions(await response.json());
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [eventId, name, nameQuestion]);

  const visibleQuestions = useMemo(
    () => form.questions.filter((question) => isVisible(question, answers)),
    [answers, form.questions],
  );

  function updateAnswer(key: string, value: string | number | string[]) {
    setAnswers((current) => {
      const next = { ...current, [key]: value };
      for (const question of form.questions) {
        if (question.visible_when?.field === key && !isVisible(question, next)) delete next[question.field_key];
      }
      return next;
    });
    if (key === "nombre") setSuggestions([]);
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function toggleOption(question: FormQuestion, value: string) {
    const selected = Array.isArray(answers[question.field_key])
      ? answers[question.field_key] as string[]
      : [];
    const maximum = Number(question.config.maxSelections ?? 20);
    if (!selected.includes(value) && selected.length >= maximum) return;
    updateAnswer(
      question.field_key,
      selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    );
  }

  function validate() {
    const nextErrors: Record<string, string> = {};
    for (const question of visibleQuestions) {
      const value = answers[question.field_key];
      if (question.required && isEmpty(value)) {
        nextErrors[question.field_key] = "Este campo es obligatorio.";
        continue;
      }
      if (question.question_type === "multi_choice" && Array.isArray(value)) {
        if (value.length > Number(question.config.maxSelections ?? 20)) {
          nextErrors[question.field_key] = `Elegí hasta ${question.config.maxSelections} opciones.`;
        }
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMessageKind("");
    if (!validate()) {
      document.querySelector(".has-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/forms/${encodeURIComponent(form.slug)}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "No pudimos guardar tu respuesta.");
      setAnswers({});
      setMessage("¡Gracias! Tu respuesta ya se sumó al mapa y a la síntesis.");
      setMessageKind("success");
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos enviar la respuesta. Revisá tu conexión e intentá de nuevo.");
      setMessageKind("error");
    } finally {
      setPending(false);
    }
  }

  function chooseAttendee(attendee: Attendee) {
    const matchedProvince = matchProvince(attendee.province);
    const province = PROVINCES.find((item) => item.id === matchedProvince);
    setAnswers((current) => ({
      ...current,
      nombre: attendee.display_name,
      ...(province ? { provincia: province.id } : {}),
      ...(attendee.locality ? { localidad: attendee.locality } : {}),
    }));
    setSuggestions([]);
  }

  function renderControl(question: FormQuestion) {
    const value = answers[question.field_key];
    const stringValue = typeof value === "string" ? value : "";
    const errorClass = errors[question.field_key] ? " has-error" : "";

    if (question.question_type === "province") {
      return (
        <div className={`field${errorClass}`}>
          <label className="field-label" htmlFor={question.field_key}>{question.label}</label>
          <div className="select-wrap">
            <select id={question.field_key} className="select" value={stringValue} onChange={(event) => updateAnswer(question.field_key, event.target.value)}>
              <option value="">Elegí tu provincia…</option>
              {PROVINCES.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
            </select>
          </div>
          {errors[question.field_key] && <p className="field-error">{errors[question.field_key]}</p>}
        </div>
      );
    }

    if (question.question_type === "participant_lookup" || question.question_type === "locality" || question.question_type === "text" || question.question_type === "textarea") {
      const isName = question.question_type === "participant_lookup";
      const isLong = question.question_type === "textarea";
      return (
        <div className={`field${errorClass}`}>
          <label className="field-label" htmlFor={question.field_key}>{question.label}</label>
          {question.help_text && <p className="muted small mt-0">{question.help_text}</p>}
          {isLong ? (
            <textarea
              className="textarea"
              id={question.field_key}
              value={stringValue}
              maxLength={2000}
              onChange={(event) => updateAnswer(question.field_key, event.target.value)}
            />
          ) : (
            <div className={isName ? "autocomplete" : undefined}>
              <input
                className="input"
                id={question.field_key}
                value={stringValue}
                autoComplete={isName ? "name" : "off"}
                maxLength={200}
                placeholder={question.question_type === "locality" ? "Localidad, ciudad o barrio" : "Nombre y apellido"}
                onChange={(event) => updateAnswer(question.field_key, event.target.value)}
              />
              {isName && searching && <p className="muted small">Buscando coincidencias…</p>}
              {isName && suggestions.length > 0 && (
                <div className="autocomplete__list">
                  {suggestions.map((attendee) => (
                    <button className="autocomplete__item" type="button" key={`${attendee.display_name}-${attendee.locality}`} onClick={() => chooseAttendee(attendee)}>
                      <b>{attendee.display_name}</b>
                      <span>{[attendee.locality, attendee.province].filter(Boolean).join(", ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {errors[question.field_key] && <p className="field-error">{errors[question.field_key]}</p>}
        </div>
      );
    }

    if (question.question_type === "scale") {
      const minimum = Number(question.config.min ?? 0);
      const maximum = Number(question.config.max ?? 5);
      return (
        <div className={`field${errorClass}`} data-field={question.field_key}>
          <span className="field-label">{question.label}</span>
          {question.help_text && <p className="survey-step__hint muted small">{question.help_text}</p>}
          <div className="linear-scale">
            <div className="linear-scale__row">
              {Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index).map((number) => (
                <label className={`linear-scale__opt${value === number ? " is-checked" : ""}`} key={number}>
                  <input type="radio" name={question.field_key} checked={value === number} onChange={() => updateAnswer(question.field_key, number)} />
                  <span>{number}</span>
                </label>
              ))}
            </div>
            <div className="linear-scale__labels">
              <span>{minimum} = {String(question.config.minLabel ?? "")}</span>
              <span>{maximum} = {String(question.config.maxLabel ?? "")}</span>
            </div>
          </div>
          {errors[question.field_key] && <p className="field-error">{errors[question.field_key]}</p>}
        </div>
      );
    }

    const isMulti = question.question_type === "multi_choice";
    const selected = Array.isArray(value) ? value : [];
    return (
      <div className={`field${errorClass}`} data-field={question.field_key}>
        <span className="field-label">{question.label}</span>
        {question.help_text && <p className="survey-step__hint muted small">{question.help_text}</p>}
        <div className="option-list" role={isMulti ? "group" : "radiogroup"}>
          {question.options.map((option) => {
            const checked = isMulti ? selected.includes(option.value) : value === option.value;
            const disabled = isMulti && !checked && selected.length >= Number(question.config.maxSelections ?? 20);
            return (
              <label className={`option-card${checked ? " is-checked" : ""}${disabled ? " is-disabled" : ""}`} key={option.value}>
                <input
                  type={isMulti ? "checkbox" : "radio"}
                  name={question.field_key}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => isMulti ? toggleOption(question, option.value) : updateAnswer(question.field_key, option.value)}
                />
                <span className={`option-card__box ${isMulti ? "square" : "round"}`}>
                  {isMulti ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m20 6-11 11-5-5" /></svg> : <span className="dot" />}
                </span>
                <span className="option-card__label">{option.label}</span>
              </label>
            );
          })}
        </div>
        {isMulti && <div className="field-counter">{selected.length}/{String(question.config.maxSelections ?? 20)} elegidos</div>}
        {errors[question.field_key] && <p className="field-error">{errors[question.field_key]}</p>}
      </div>
    );
  }

  return (
    <form className="survey" onSubmit={handleSubmit} noValidate>
      {visibleQuestions.map((question, index) => (
        <section className="card" key={question.id}>
          <div className="survey-step__title">
            <span className="survey-step__num">{index + 1}</span>
            {question.label}
          </div>
          {renderControl(question)}
        </section>
      ))}
      <div className="survey-submit">
        <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
          {pending ? "Enviando…" : "Enviar respuesta"}
        </button>
        {message && <p className={`form-msg is-visible ${messageKind}`} role="status">{message}</p>}
      </div>
    </form>
  );
}
