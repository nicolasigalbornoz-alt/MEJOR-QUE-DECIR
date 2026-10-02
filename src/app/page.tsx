import Link from "next/link";
import { QuestionsPuzzle } from "@/components/QuestionsPuzzle";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { loadPublicReport } from "@/lib/data/public-report";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const report = await loadPublicReport();

  return (
    <>
      <SiteHeader />

      <main className="home-page">
        <section className="hero wrap">
          <div className="pin-badge-wrap">
            <svg className="pin-badge" viewBox="0 0 62.36 90.83" aria-hidden="true">
              <circle cx="30.18" cy="60.65" r="30.18" fill="#29a6dd" />
              <circle cx="30.18" cy="60.65" r="17.06" fill="var(--sky-050)" />
              <circle cx="30.18" cy="60.65" r="7.82" fill="#29a6dd" />
              <polygon points="39.74,26.02 33.88,17.46 52.52,0 62.36,13.83" fill="#04537a" />
            </svg>
          </div>
          <span className="eyebrow">Encuesta federal · Jóvenes FR</span>
          <h1>MEJOR QUE DECIR</h1>
          <p>
            Antes de proponer, escuchamos. El <b>19 de septiembre de 2026</b> encuestamos a los y las
            jóvenes del Encuentro Nacional de Jóvenes FR sobre su distrito, sus problemas, sus
            necesidades y su visión del país: es la pieza que las juventudes le aportan a nuestro
            proyecto de país. La armamos en tiempo real en un mapa federal y un documento de síntesis,
            pensados como un rompecabezas.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-block" href="/encuesta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Responder la encuesta
            </Link>
            <Link className="btn btn-secondary btn-block" href="/mapa">
              Ver el mapa federal
            </Link>
          </div>
        </section>

        <section className="section wrap">
          <div className={`data-banner ${report.isDemo ? "demo" : "live"}`}>
            <span className="dot" />
            {report.isDemo ? "Mostrando respuestas sintéticas de demostración." : "Datos en vivo del Encuentro Nacional de Jóvenes FR."}
          </div>
          <div className="stat-row">
            <div className="stat"><b>{report.totalResponses}</b><span>Respuestas</span></div>
            <div className="stat"><b>{report.totalProvinces}</b><span>Provincias</span></div>
            <div className="stat"><b>{report.totalLocalidades}</b><span>Localidades</span></div>
          </div>
        </section>

        <section className="section-tight wrap">
          <h2>¿Qué es &quot;Mejor que decir&quot;?</h2>
          <p>
            Es el ejercicio de escucha de Jóvenes FR: en vez de bajar un diagnóstico ya armado,
            les preguntamos directamente a los pibes y las pibas de cada distrito qué está pasando
            donde viven. Sus respuestas arman, en tiempo real, un mapa federal y un informe de
            síntesis con la foto real de la juventud argentina.
          </p>
        </section>

        <section className="section-tight wrap">
          <h2>Qué preguntamos</h2>
          <QuestionsPuzzle />
        </section>

        <section className="section wrap center">
          <div className="card">
            <h2 className="mt-0">¿Todavía no respondiste la encuesta?</h2>
            <p>Te toma dos minutos y ayuda a que tu distrito esté representado en el mapa.</p>
            <Link className="btn btn-primary btn-block" href="/encuesta">
              Ir a la encuesta
            </Link>
          </div>
        </section>

        <section className="section-tight wrap center">
          <Link className="btn btn-ghost" href="/eventos">Ver información de eventos</Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
