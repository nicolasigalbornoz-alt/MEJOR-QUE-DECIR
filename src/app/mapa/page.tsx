import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { FederalMapLoader } from "@/features/reports/FederalMapLoader";
import { loadPublicReport } from "@/lib/data/public-report";

export const metadata: Metadata = {
  title: "Mapa federal, MEJOR QUE DECIR",
  description: "Mapa de las respuestas de jóvenes por provincia y localidad.",
};
export const dynamic = "force-dynamic";

export default async function MapPage() {
  const report = await loadPublicReport();
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Mapa federal</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Lo que dijo cada distrito</h1>
          <p>Tocá una provincia para ver problemas, necesidades y visión del país. El color indica cuántas respuestas llegaron.</p>
        </section>
        <section className="section-tight wrap">
          <div className={`data-banner ${report.isDemo ? "demo" : "live"}`}><span className="dot" />{report.isDemo ? "Mapa generado con respuestas sintéticas de demostración." : "Datos agregados del Encuentro Nacional de Jóvenes FR."}</div>
          <div className="stat-row">
            <div className="stat"><b>{report.totalResponses}</b><span>Respuestas</span></div>
            <div className="stat"><b>{report.totalProvinces}</b><span>Provincias</span></div>
            <div className="stat"><b>{report.totalLocalidades}</b><span>Localidades</span></div>
          </div>
          <FederalMapLoader report={report} />
        </section>
        <section className="section-tight wrap">
          <div className="card center">
            <h2 className="mt-0" style={{ fontSize: 19 }}>¿Falta tu distrito?</h2>
            <p>Sumá tu respuesta y aparecé en el mapa.</p>
            <a className="btn btn-primary" href="/encuesta">Responder la encuesta</a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
