import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { addQuestion, createFormVersion, publishFormVersion, removeDraftQuestion, updateDraftQuestion, updateForm } from "@/app/admin/(panel)/forms/actions";
import { requireStaff } from "@/lib/auth/require-staff";

export const metadata: Metadata = { title: "Editor de formulario, MEJOR QUE DECIR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminFormEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; published?: string; version?: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const [{ data: form }, { data: versions }, { data: events }, query] = await Promise.all([
    supabase.from("forms").select("id,slug,title,intro,status,event_id").eq("id", id).maybeSingle(),
    supabase.from("form_versions").select("id,version_number,status,created_at,published_at").eq("form_id", id).order("version_number", { ascending: false }),
    supabase.from("events").select("id,title").order("created_at", { ascending: false }),
    searchParams,
  ]);
  if (!form) notFound();
  const chosenVersion = versions?.find((version) => version.id === query.version)
    ?? versions?.find((version) => version.status === "draft")
    ?? versions?.[0];
  if (!chosenVersion) redirect("/admin/forms?error=version");

  const { data: questions, error: questionsError } = await supabase
    .from("form_questions")
    .select("id,field_key,label,help_text,question_type,position,required,config,form_question_options(value,label,position)")
    .eq("version_id", chosenVersion.id)
    .order("position");

  return (
    <>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Administración · Formularios</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>{form.title}</h1>
          <p>Las versiones publicadas quedan congeladas para conservar el significado histórico de las respuestas.</p>
        </section>
        <section className="section-tight wrap">
          <p><Link href="/admin/forms">← Formularios</Link></p>
          {query.error && <p className="form-msg is-visible error" role="alert">{query.error === "slug-locked" ? "No se puede cambiar la dirección de un formulario ya publicado." : `No pudimos completar la operación (${query.error}).`}</p>}
          {query.saved && <p className="form-msg is-visible success" role="status">Cambios guardados en el borrador.</p>}
          {query.published && <p className="form-msg is-visible success" role="status">Versión publicada.</p>}

          <div className="card">
            <h2 className="mt-0" style={{ fontSize: 19 }}>Información del formulario</h2>
            <form action={updateForm}>
              <input type="hidden" name="formId" value={form.id} />
              <div className="field"><label className="field-label" htmlFor="formTitle">Título</label><input className="input" id="formTitle" name="title" defaultValue={form.title} maxLength={180} required /></div>
              <div className="field"><label className="field-label" htmlFor="formSlug">Dirección corta</label><input className="input" id="formSlug" name="slug" defaultValue={form.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></div>
              <div className="field"><label className="field-label" htmlFor="formIntro">Introducción</label><textarea className="textarea" id="formIntro" name="intro" defaultValue={form.intro} maxLength={12000} /></div>
              <div className="field"><label className="field-label" htmlFor="formEvent">Evento</label><div className="select-wrap"><select className="select" id="formEvent" name="eventId" defaultValue={form.event_id ?? ""}><option value="">Sin evento</option>{events?.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></div></div>
              <button className="btn btn-ghost" type="submit">Guardar información</button>
            </form>
          </div>

          <div className="card">
            <h2 className="mt-0" style={{ fontSize: 19 }}>Versiones</h2>
            <ul>{versions?.map((version) => <li key={version.id}>Versión {version.version_number} — {version.status}{version.published_at ? ` · ${new Date(version.published_at).toLocaleDateString("es-AR")}` : ""} {version.id === chosenVersion.id ? "(seleccionada)" : <Link href={`/admin/forms/${form.id}?version=${version.id}`}>Ver</Link>}</li>)}</ul>
            <form action={createFormVersion}><input type="hidden" name="formId" value={form.id} /><button className="btn btn-secondary" type="submit">Crear nueva versión borrador</button></form>
          </div>

          <div className="card">
            <h2 className="mt-0" style={{ fontSize: 19 }}>Preguntas · versión {chosenVersion.version_number} ({chosenVersion.status})</h2>
            {questionsError && <p className="empty-note">No pudimos consultar las preguntas.</p>}
            {questions?.map((question) => (
              <article className="card" key={question.id}>
                <b>{question.position + 1}. {question.label}</b>
                <p className="muted small">{question.field_key} · {question.question_type}{question.required ? " · obligatorio" : ""}</p>
                {question.form_question_options?.length ? <ul>{question.form_question_options.sort((a, b) => a.position - b.position).map((option) => <li key={option.value}>{option.label}</li>)}</ul> : null}
                {chosenVersion.status === "draft" && <>
                  <details>
                    <summary>Editar pregunta</summary>
                    <form action={updateDraftQuestion}>
                      <input type="hidden" name="questionId" value={question.id} /><input type="hidden" name="formId" value={form.id} />
                      <div className="field"><label className="field-label" htmlFor={`label-${question.id}`}>Pregunta</label><input className="input" id={`label-${question.id}`} name="label" defaultValue={question.label} maxLength={500} required /></div>
                      <div className="field"><label className="field-label" htmlFor={`help-${question.id}`}>Ayuda</label><input className="input" id={`help-${question.id}`} name="helpText" defaultValue={question.help_text} maxLength={1000} /></div>
                      {["single_choice", "multi_choice"].includes(question.question_type) && <div className="field"><label className="field-label" htmlFor={`opts-${question.id}`}>Opciones (`valor|etiqueta`, una por línea)</label><textarea className="textarea" id={`opts-${question.id}`} name="options" defaultValue={question.form_question_options?.sort((a, b) => a.position - b.position).map((option) => `${option.value}|${option.label}`).join("\n")} /></div>}
                      <label className="option-card"><input type="checkbox" name="required" defaultChecked={question.required} /><span className="option-card__label">Respuesta obligatoria</span></label>
                      <div className="survey-submit"><button className="btn btn-ghost" type="submit">Guardar pregunta</button></div>
                    </form>
                  </details>
                  <form action={removeDraftQuestion}><input type="hidden" name="questionId" value={question.id} /><input type="hidden" name="formId" value={form.id} /><button className="btn btn-ghost" type="submit">Quitar del borrador</button></form>
                </>}
              </article>
            ))}
          </div>

          {chosenVersion.status === "draft" && (
            <>
              <div className="card">
                <h2 className="mt-0" style={{ fontSize: 19 }}>Agregar pregunta</h2>
                <p className="muted small">Para selección, ingresá una opción por línea en formato <code>valor|etiqueta</code>. Para escalas, indicá el mínimo y el máximo.</p>
                <form action={addQuestion}>
                  <input type="hidden" name="versionId" value={chosenVersion.id} />
                  <div className="field"><label className="field-label" htmlFor="fieldKey">Clave interna</label><input className="input" id="fieldKey" name="fieldKey" pattern="[a-zA-Z][a-zA-Z0-9_]{0,63}" required /></div>
                  <div className="field"><label className="field-label" htmlFor="questionLabel">Pregunta</label><input className="input" id="questionLabel" name="label" maxLength={500} required /></div>
                  <div className="field"><label className="field-label" htmlFor="helpText">Ayuda (opcional)</label><input className="input" id="helpText" name="helpText" maxLength={1000} /></div>
                  <div className="field"><label className="field-label" htmlFor="questionType">Tipo de respuesta</label><div className="select-wrap"><select className="select" id="questionType" name="questionType"><option value="text">Texto corto</option><option value="textarea">Texto largo</option><option value="single_choice">Selección única</option><option value="multi_choice">Selección múltiple</option><option value="scale">Escala</option><option value="province">Provincia</option><option value="locality">Localidad</option><option value="participant_lookup">Nombre/autocompletado</option></select></div></div>
                  <div className="field"><label className="field-label" htmlFor="options">Opciones (una por línea)</label><textarea className="textarea" id="options" name="options" placeholder={'casa|Acceso a la vivienda\ntrabajo|Falta de empleo'} /></div>
                  <div className="field"><label className="field-label" htmlFor="scaleMin">Mínimo de escala</label><input className="input" id="scaleMin" name="scaleMin" type="number" defaultValue={1} /></div>
                  <div className="field"><label className="field-label" htmlFor="scaleMax">Máximo de escala</label><input className="input" id="scaleMax" name="scaleMax" type="number" defaultValue={5} /></div>
                  <div className="field"><label className="field-label" htmlFor="maxSelections">Máximo de selecciones</label><input className="input" id="maxSelections" name="maxSelections" type="number" min={1} max={20} defaultValue={3} /></div>
                  <label className="option-card"><input type="checkbox" name="required" /><span className="option-card__label">Respuesta obligatoria</span></label>
                  <div className="survey-submit"><button className="btn btn-primary" type="submit">Agregar pregunta</button></div>
                </form>
              </div>
              <div className="card">
                <h2 className="mt-0" style={{ fontSize: 19 }}>Publicar esta versión</h2>
                <p className="muted">Al publicar, la versión anterior queda archivada y sus respuestas mantienen su versión original.</p>
                <form action={publishFormVersion}><input type="hidden" name="versionId" value={chosenVersion.id} /><input type="hidden" name="formId" value={form.id} /><button className="btn btn-primary" type="submit">Publicar versión</button></form>
              </div>
            </>
          )}
        </section>
    </>
  );
}
