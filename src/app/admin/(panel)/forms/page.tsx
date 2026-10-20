import Link from "next/link";
import type { Metadata } from "next";
import { createForm } from "@/app/admin/(panel)/forms/actions";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";

export const metadata: Metadata = { title: "Administrar formularios, MEJOR QUE DECIR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase, access } = await requireStaff();
  const canEdit = hasRole(access.role, "editor");
  const [{ data: forms, error }, { data: events }, query] = await Promise.all([
    supabase.from("forms").select("id,slug,title,intro,status,event_id,form_versions(version_number,status)").order("created_at", { ascending: false }),
    supabase.from("events").select("id,title,status").order("created_at", { ascending: false }),
    searchParams,
  ]);

  return (
    <>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Administración</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Formularios</h1>
          <p>Creá formularios y publicá versiones sin cambiar las respuestas anteriores.</p>
        </section>
        <section className="section-tight wrap">
          {query.error && <p className="form-msg is-visible error" role="alert">No pudimos completar la operación ({query.error}). Revisá los campos y el estado de la base.</p>}
          {canEdit && <div className="card">
            <h2 className="mt-0" style={{ fontSize: 19 }}>Crear formulario</h2>
            <form action={createForm}>
              <div className="field"><label className="field-label" htmlFor="title">Título</label><input className="input" id="title" name="title" maxLength={180} required /></div>
              <div className="field"><label className="field-label" htmlFor="slug">Dirección corta</label><input className="input" id="slug" name="slug" placeholder="encuesta-del-evento" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></div>
              <div className="field"><label className="field-label" htmlFor="intro">Introducción</label><textarea className="textarea" id="intro" name="intro" maxLength={12000} /></div>
              <div className="field"><label className="field-label" htmlFor="eventId">Evento asociado</label><div className="select-wrap"><select className="select" id="eventId" name="eventId"><option value="">Sin evento</option>{events?.map((event) => <option key={event.id} value={event.id}>{event.title} ({event.status})</option>)}</select></div></div>
              <button className="btn btn-primary" type="submit">Crear borrador</button>
            </form>
          </div>}

          <h2>Formularios existentes</h2>
          {error && <p className="empty-note">La migración de formularios todavía no está aplicada en Supabase.</p>}
          {forms?.map((form) => {
            const published = form.form_versions?.find((version) => version.status === "published");
            return (
              <article className="card" key={form.id}>
                <h3 className="mt-0">{form.title}</h3>
                <p className="muted small">/{form.slug} · {published ? `Versión ${published.version_number} publicada` : "Sin versión publicada"}</p>
                <Link className="btn btn-secondary" href={`/admin/forms/${form.id}`}>{canEdit ? "Editar versiones" : "Ver versiones"}</Link>
                {published && form.status === "published" && <Link className="btn btn-ghost" href={`/formularios/${form.slug}`} style={{ marginLeft: 8 }}>Vista pública</Link>}
              </article>
            );
          })}
        </section>
    </>
  );
}
