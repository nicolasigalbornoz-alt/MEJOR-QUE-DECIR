import Link from "next/link";
import type { Metadata } from "next";
import { changeEventStatus, createEvent, updateEvent } from "@/app/admin/(panel)/events/actions";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { formatArgentinaDate, toArgentinaDateTimeInput } from "@/lib/dates";

export const metadata: Metadata = { title: "Administrar eventos, MEJOR QUE DECIR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = { draft: "Borrador", published: "Publicado", archived: "Archivado" };
const messages: Record<string, string> = {
  invalid: "Revisá los datos del evento.",
  slug: "Ya existe un evento con ese identificador.",
  save: "No pudimos guardar el evento. Verificá que la migración de Supabase esté aplicada.",
};

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase, access } = await requireStaff();
  const canEdit = hasRole(access.role, "editor");
  const [{ data: events, error }, query] = await Promise.all([
    supabase.from("events").select("id,slug,title,description,starts_at,ends_at,status").order("created_at", { ascending: false }),
    searchParams,
  ]);
  const message = query.error ? messages[query.error] : undefined;

  return (
    <>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Administración</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Eventos</h1>
          <p>Creá encuentros y publicá su información cuando esté lista.</p>
        </section>
        <section className="section-tight wrap">
          {message && <p className="form-msg is-visible error" role="alert">{message}</p>}
          {query.saved && <p className="form-msg is-visible success" role="status">Cambios guardados.</p>}
          {error && <p className="form-msg is-visible error" role="alert">No se pudo leer la lista. Revisá la migración `create_events_forms_and_reports`.</p>}

          {canEdit && <div className="card">
            <h2 className="mt-0" style={{ fontSize: 19 }}>Crear evento</h2>
            <form action={createEvent}>
              <div className="field"><label className="field-label" htmlFor="title">Título</label><input className="input" id="title" name="title" maxLength={180} required /></div>
              <div className="field"><label className="field-label" htmlFor="slug">Dirección corta</label><input className="input" id="slug" name="slug" placeholder="encuentro-jovenes-2027" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></div>
              <div className="field"><label className="field-label" htmlFor="description">Descripción</label><textarea className="textarea" id="description" name="description" maxLength={12000} /></div>
              <div className="field"><label className="field-label" htmlFor="startsAt">Fecha y hora (opcional)</label><input className="input" id="startsAt" name="startsAt" type="datetime-local" /></div>
              <div className="field"><label className="field-label" htmlFor="endsAt">Fin (opcional)</label><input className="input" id="endsAt" name="endsAt" type="datetime-local" /></div>
              <button className="btn btn-primary" type="submit">Crear borrador</button>
            </form>
          </div>}

          <h2>Eventos existentes</h2>
          {events?.length ? events.map((event) => (
            <article className="card" key={event.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 className="mt-0">{event.title}</h3>
                  <p className="muted small">/{event.slug} · {statusLabels[event.status] ?? event.status}</p>
                  {event.starts_at && <p>{formatArgentinaDate(event.starts_at, true)}</p>}
                </div>
                {event.status === "published" && <Link className="btn btn-secondary" href={`/eventos/${event.slug}`}>Ver público</Link>}
              </div>
              {canEdit && <><details>
                <summary>Editar información</summary>
                <form action={updateEvent}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <div className="field"><label className="field-label" htmlFor={`title-${event.id}`}>Título</label><input className="input" id={`title-${event.id}`} name="title" defaultValue={event.title} maxLength={180} required /></div>
                  <div className="field"><label className="field-label" htmlFor={`slug-${event.id}`}>Dirección corta</label><input className="input" id={`slug-${event.id}`} name="slug" defaultValue={event.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></div>
                  <div className="field"><label className="field-label" htmlFor={`description-${event.id}`}>Descripción</label><textarea className="textarea" id={`description-${event.id}`} name="description" defaultValue={event.description} maxLength={12000} /></div>
                  <div className="field"><label className="field-label" htmlFor={`starts-${event.id}`}>Fecha y hora (Argentina)</label><input className="input" id={`starts-${event.id}`} name="startsAt" type="datetime-local" defaultValue={toArgentinaDateTimeInput(event.starts_at)} /></div>
                  <div className="field"><label className="field-label" htmlFor={`ends-${event.id}`}>Fin (Argentina)</label><input className="input" id={`ends-${event.id}`} name="endsAt" type="datetime-local" defaultValue={toArgentinaDateTimeInput(event.ends_at)} /></div>
                  <button className="btn btn-ghost" type="submit">Guardar información</button>
                </form>
              </details>
              <form action={changeEventStatus} style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                <input type="hidden" name="eventId" value={event.id} />
                <div className="field">
                  <label className="field-label" htmlFor={`status-${event.id}`}>Estado</label>
                  <div className="select-wrap"><select className="select" id={`status-${event.id}`} name="status" defaultValue={event.status}>
                    <option value="draft">Borrador</option><option value="published">Publicado</option><option value="archived">Archivado</option>
                  </select></div>
                </div>
                <button className="btn btn-ghost" type="submit">Guardar estado</button>
              </form></>}
            </article>
          )) : <p className="empty-note">Todavía no hay eventos. Al aplicar las migraciones aparecerá también el encuentro actual.</p>}
        </section>
    </>
  );
}
