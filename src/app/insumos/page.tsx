import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { DriveFolder } from "@/features/events/DriveFolder";

export const metadata: Metadata = {
  title: "Insumos para la militancia, MEJOR QUE DECIR",
  description: "Materiales y recursos para la militancia de Jóvenes FR.",
};

export default function ResourcesPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Para la militancia</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Insumos para la militancia</h1>
          <p>Materiales, documentos y espacios de formación para llevar a cada distrito lo que salió de “Mejor que decir”.</p>
        </section>
        <section className="section-tight wrap"><DriveFolder /></section>
        <section className="section-tight wrap">
          <a className="card feature drive-link-card" style={{ alignItems: "center" }} href="https://estudiosrenovacion.com/" target="_blank" rel="noopener noreferrer">
            <div className="feature__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" /></svg></div>
            <div style={{ flex: 1 }}><h3>Centros de Estudios (Red de Observatorios) ↗</h3><p>Espacio de formación y análisis territorial de los Centros de Estudios.</p></div>
          </a>
        </section>
        <section className="section-tight wrap center">
          <div className="card"><h2 className="mt-0" style={{ fontSize: 19 }}>¿Todavía no respondiste la encuesta?</h2><p>Los insumos se nutren de lo que cada distrito cuenta en “Mejor que decir”.</p><a className="btn btn-ghost" href="/encuesta">Responder la encuesta</a></div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
