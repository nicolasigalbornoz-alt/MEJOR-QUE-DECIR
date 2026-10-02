import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { changeActDocumentVisibility, deleteCommissionAct } from "@/app/admin/actas/actions";
import { ActUploadForm } from "@/features/events/ActUploadForm";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = { title: "Administrar actas, MEJOR QUE DECIR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const messages: Record<string, string> = {
  validation: "Revisá el archivo y el resumen. Se aceptan Word de hasta 8 MB y resúmenes de hasta 2.000 caracteres.",
  type: "El archivo no parece ser un documento Word válido.",
  commission: "Elegí una comisión activa.",
  upload: "No se pudo guardar el archivo en Storage.",
  save: "No se pudieron guardar los datos del acta. Verificá que las migraciones estén aplicadas.",
  "not-found": "No encontramos esa acta.",
};

export default async function AdminActsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const [{ data: commissions }, { data: acts, error }, query] = await Promise.all([
    supabase.from("commissions").select("id,name").eq("active", true).order("position"),
    supabase.from("commission_acts").select("id,commission_id,summary,storage_path,original_filename,file_size_bytes,document_public,uploaded_at,commission:commissions(name)").order("uploaded_at", { ascending: false }),
    searchParams,
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Administración</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Actas de comisión</h1>
          <p>El resumen se publica en la síntesis. El Word queda privado salvo que lo marques público.</p>
        </section>
        <section className="section-tight wrap">
          <p><Link href="/admin">← Panel</Link></p>
          {query.error && <p className="form-msg is-visible error" role="alert">{messages[query.error] ?? "No se pudo completar la operación."}</p>}
          {query.saved && <p className="form-msg is-visible success" role="status">Acta guardada.</p>}
          {error && <p className="empty-note">No se pudieron consultar las actas. Verificá la migración de Supabase.</p>}

          <div className="card">
            <h2 className="mt-0" style={{ fontSize: 19 }}>Subir o reemplazar acta</h2>
            <ActUploadForm commissions={commissions ?? []} />
          </div>

          <h2>Actas cargadas</h2>
          {acts?.map((act) => (
            <article className="card" key={act.id}>
                  <h3 className="mt-0">{act.commission?.[0]?.name ?? act.commission_id}</h3>
              <p className="acta-resumen">{act.summary}</p>
              <p className="muted small">{act.original_filename} · {(act.file_size_bytes / (1024 * 1024)).toFixed(2)} MB · {act.document_public ? "Documento público" : "Documento privado"}</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a className="btn btn-ghost" href={`/api/actas/${act.id}/document`}>Abrir Word</a>
                <form action={changeActDocumentVisibility}>
                  <input type="hidden" name="actId" value={act.id} />
                  <input type="hidden" name="documentPublic" value={act.document_public ? "false" : "true"} />
                  <button className="btn btn-ghost" type="submit">{act.document_public ? "Volver privado" : "Hacer público"}</button>
                </form>
                <form action={deleteCommissionAct}>
                  <input type="hidden" name="actId" value={act.id} />
                  <button className="btn btn-ghost" type="submit">Eliminar acta</button>
                </form>
              </div>
            </article>
          ))}
          <p className="muted small">Los links firmados vencen en una hora. Al volver privado un documento, no se emiten nuevos links públicos.</p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
