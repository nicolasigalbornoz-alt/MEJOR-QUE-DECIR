import Link from "next/link";
import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth/require-staff";

export const metadata: Metadata = { title: "Respuestas privadas, MEJOR QUE DECIR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

function displayValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default async function AdminResponsesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const pageValue = Number((await searchParams).page ?? "1");
  const page = Number.isInteger(pageValue) ? Math.max(1, pageValue) : 1;
  const start = (page - 1) * PAGE_SIZE;
  const { supabase } = await requireStaff();
  const { data: submissions, error, count } = await supabase
    .from("form_submissions")
    .select("id,display_name,province_id,locality,answers,submitted_at,is_demo,form:forms(title)", { count: "exact" })
    .eq("is_demo", false)
    .order("submitted_at", { ascending: false })
    .range(start, start + PAGE_SIZE - 1);

  return (
    <>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Administración · Privado</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Respuestas</h1>
          <p>Vista administrativa de envíos. Estos datos personales no se muestran en el mapa ni en la síntesis.</p>
        </section>
        <section className="section-tight wrap">
          {error ? <div className="card" role="alert"><p>No se pudieron consultar las respuestas. Aplicá la migración de formularios para habilitar esta vista.</p></div> : <>
            <p className="muted">{count ?? 0} respuestas reales · página {page}</p>
            {submissions?.length ? submissions.map((submission) => {
              const answers = submission.answers && typeof submission.answers === "object" ? Object.entries(submission.answers as Record<string, unknown>) : [];
              return (
                <article className="card" key={submission.id}>
                  <h2 className="mt-0" style={{ fontSize: 18 }}>{submission.display_name}</h2>
                  <p className="muted small">{submission.province_id} · {submission.locality} · {new Date(submission.submitted_at).toLocaleString("es-AR")}</p>
                  <details><summary>Ver respuestas ({answers.length})</summary><dl className="response-detail">{answers.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{displayValue(value)}</dd></div>)}</dl></details>
                </article>
              );
            }) : <p className="empty-note">Todavía no hay respuestas reales en Supabase. El sitio sigue mostrando el fixture sintético por separado.</p>}
            <nav className="hero-actions" aria-label="Paginación de respuestas">
              {page > 1 && <Link className="btn btn-ghost" href={`/admin/respuestas?page=${page - 1}`}>Anterior</Link>}
              {(count ?? 0) > start + PAGE_SIZE && <Link className="btn btn-ghost" href={`/admin/respuestas?page=${page + 1}`}>Siguiente</Link>}
            </nav>
          </>}
        </section>
    </>
  );
}
