import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { CommissionPuzzle } from "@/features/reports/CommissionPuzzle";
import { PrintButton } from "@/features/reports/PrintButton";
import { COMMISSION_CONCLUSIONS } from "@/data/conclusions";
import { PROVINCES } from "@/data/provinces";
import { listPublicActs } from "@/lib/data/acts";
import { loadPublicReport } from "@/lib/data/public-report";
import type { PublicReport } from "@/features/reports/types";

export const metadata: Metadata = {
  title: "Síntesis, MEJOR QUE DECIR",
  description: "Síntesis de los problemas, necesidades y visión del país de los y las jóvenes.",
};
export const dynamic = "force-dynamic";

const SITUATION: Record<number, string> = { 1: "muy mala", 2: "mala", 3: "regular", 4: "buena", 5: "muy buena" };
const VISION: Record<number, string> = { [-2]: "muy pesimista", [-1]: "pesimista", 0: "neutral", 1: "optimista", 2: "muy optimista" };
const REGIONS = ["NOA", "NEA", "Centro", "Cuyo", "Patagonia"];

function sorted(values: Record<string, number>) {
  return Object.entries(values).sort((a, b) => b[1] - a[1]);
}

function barList(values: Record<string, number>, limit = 8) {
  const entries = sorted(values).slice(0, limit);
  if (!entries.length) return <p className="empty-note">Todavía no hay datos suficientes.</p>;
  const max = Math.max(...entries.map(([, value]) => value), 1);
  return <ul className="bar-list">{entries.map(([label, value]) => <li className="bar-row" key={label}><div className="bar-row__top"><span className="label">{label}</span><span className="value">{value}</span></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(6, value / max * 100)}%` }} /></div></li>)}</ul>;
}

function roundTo100(counts: number[], total: number) {
  if (!total) return counts.map(() => 0);
  const percentages = counts.map((count) => Math.max(0, count) / total * 100);
  const rounded = percentages.map(Math.floor);
  const missing = 100 - rounded.reduce((sum, item) => sum + item, 0);
  const remainderOrder = percentages.map((value, index) => [value - Math.floor(value), index] as const).sort((a, b) => b[0] - a[0]);
  for (let index = 0; index < missing && index < remainderOrder.length; index++) rounded[remainderOrder[index][1]]++;
  return rounded;
}

function VisionChart({ report }: { report: PublicReport }) {
  const counts = [-2, -1, 0, 1, 2].map((key) => report.nacVision[String(key)] ?? 0);
  const percentages = roundTo100(counts, report.totalResponses);
  const labels = ["Muy pesimista", "Pesimista", "Neutral", "Optimista", "Muy optimista"];
  const colors = ["var(--div-warm)", "#f2a7a6", "var(--div-mid)", "var(--seq-250)", "var(--div-cool)"];
  return <>
    <div className="diverging-row"><div className="diverging-track" role="img" aria-label="Distribución de la visión del país">{percentages.map((percentage, index) => <span key={labels[index]} className={index < 2 ? "diverging-fill-neg" : index > 2 ? "diverging-fill-pos" : "diverging-spacer"} style={{ width: `${percentage}%`, background: colors[index] }} />)}</div></div>
    <div className="tag-row small">{labels.map((label, index) => <span className="tag" key={label}>{label} {percentages[index]}%</span>)}</div>
  </>;
}

function RegionsList({ report }: { report: PublicReport }) {
  const counts = Object.fromEntries(REGIONS.map((region) => [region, { total: 0, situationSum: 0, situationN: 0 }]));
  for (const province of Object.values(report.byProvince)) {
    const region = counts[province.region];
    if (!region) continue;
    region.total += province.count;
    region.situationSum += province.situacionSum;
    region.situationN += province.situacionN;
  }
  const max = Math.max(...REGIONS.map((region) => counts[region].total), 1);
  return <ul className="bar-list">{REGIONS.map((region) => {
    const value = counts[region];
    const situation = value.situationN ? SITUATION[Math.round(value.situationSum / value.situationN)] : "sin datos";
    return <li className="bar-row" key={region}><div className="bar-row__top"><span className="label">{region}</span><span className="value">{value.total} · situación {situation}</span></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(6, value.total / max * 100)}%` }} /></div></li>;
  })}</ul>;
}

function SummaryNarrative({ report }: { report: PublicReport }) {
  const problems = sorted(report.nacProblemas).slice(0, 3).map(([label]) => label);
  const needs = sorted(report.nacNecesidades).slice(0, 3).map(([label]) => label);
  const situationCount = Object.values(report.nacSituacion).reduce((sum, value) => sum + value, 0);
  const visionCount = Object.values(report.nacVision).reduce((sum, value) => sum + value, 0);
  const situationMean = situationCount ? Math.round(Object.entries(report.nacSituacion).reduce((sum, [value, count]) => sum + Number(value) * count, 0) / situationCount) : null;
  const visionMean = visionCount ? Math.round(Object.entries(report.nacVision).reduce((sum, [value, count]) => sum + Number(value) * count, 0) / visionCount) : null;
  if (!report.totalResponses) return <p>Todavía no se cargaron respuestas. Este documento se completa a medida que recibe respuestas el formulario.</p>;
  return <>
    <p>Este documento resume lo que dijeron <b>{report.totalResponses} jóvenes</b> de <b>{report.totalProvinces} provincias</b> y <b>{report.totalLocalidades} localidades</b>. Es una síntesis viva que se actualiza con las respuestas recibidas.</p>
    {problems.length > 0 && <p>Los problemas que más se repiten son <b>{problems[0]}</b>{problems[1] ? `, seguido de ${problems[1]}` : ""}{problems[2] ? ` y ${problems[2]}` : ""}.</p>}
    {needs.length > 0 && <p>Entre las necesidades, lo que más aparece es <b>{needs[0]}</b>{needs[1] ? `, junto con ${needs[1]}` : ""}{needs[2] ? ` y ${needs[2]}` : ""}.</p>}
    {situationMean !== null && <p>La situación general del distrito se calificó en promedio como <b>{SITUATION[situationMean]}</b>.</p>}
    {visionMean !== null && <p>Respecto al futuro del país, la mirada general es <b>{VISION[visionMean]}</b>.</p>}
  </>;
}

export default async function SynthesisPage() {
  const [report, acts] = await Promise.all([loadPublicReport(), listPublicActs()]);
  const quotes = Object.values(report.byProvince).flatMap((province) => province.quotes).slice(0, 6);
  const provinceCount = PROVINCES.length;

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Documento de síntesis</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Lo que demandan los jóvenes</h1>
          <p>Informe generado automáticamente con las respuestas de la encuesta.</p>
          <PrintButton />
        </section>
        <section className="section-tight wrap">
          <div className={`data-banner no-print ${report.isDemo ? "demo" : "live"}`}><span className="dot" />{report.isDemo ? "Documento generado con datos sintéticos de demostración." : "Documento con resultados agregados del encuentro."}</div>
          <div className="stat-row">
            <div className="stat"><b>{report.totalResponses}</b><span>Respuestas</span></div>
            <div className="stat"><b>{report.totalProvinces}/{provinceCount}</b><span>Provincias</span></div>
            <div className="stat"><b>{report.totalLocalidades}</b><span>Localidades</span></div>
          </div>
        </section>

        <section className="section-tight wrap">
          <h2>Resumen ejecutivo</h2>
          <div id="narrative"><SummaryNarrative report={report} /></div>
        </section>
        <hr className="sep" />
        <section className="section-tight wrap"><h2>Problemas de la juventud, a nivel nacional</h2><p className="muted">Cantidad de menciones entre todos los distritos.</p>{barList(report.nacProblemas)}</section>
        <section className="section-tight wrap"><h2>Qué necesitan los y las jóvenes</h2><p className="muted">Cantidad de menciones entre todos los distritos.</p>{barList(report.nacNecesidades)}</section>
        <hr className="sep" />
        <section className="section-tight wrap"><h2>Visión del país</h2><p className="muted">Distribución de respuestas sobre el futuro.</p><div className="diverging"><VisionChart report={report} /></div></section>
        <section className="section-tight wrap"><h2>Participación por región</h2><RegionsList report={report} /></section>
        <section className="section-tight wrap"><h2>Quiénes respondieron</h2><p className="muted small mt-0">¿Participan en algún espacio político o de militancia?</p>{Object.keys(report.nacParticipa).length ? <div className="tag-row">{sorted(report.nacParticipa).map(([name, count]) => <span className="tag" key={name}>{name}: {count}</span>)}</div> : <p className="empty-note">Sin datos.</p>}</section>

        <section className="section-tight wrap">
          <h2>El rompecabezas de las comisiones</h2>
          <div className="puzzle-intro">Tocá una comisión para consultar sus resultados y el resumen público del acta.</div>
          <CommissionPuzzle report={report} acts={acts} />
        </section>
        <hr className="sep" />
        <section className="section-tight wrap">
          <h2>Documento de conclusión</h2>
          <p className="muted">Lectura editorial de los principales aportes de cada comisión.</p>
          <div id="conclusionDoc">{COMMISSION_CONCLUSIONS.map((item) => <article className="conclusion-item" key={item.commission}><h3>{item.commission}</h3><p>{item.text}</p></article>)}</div>
        </section>
        <hr className="sep" />
        <section className="section-tight wrap">
          <h2>En sus palabras</h2>
          <p className="muted">Una muestra de testimonios de las respuestas (datos sintéticos en modo demostración).</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{quotes.map((quote, index) => <blockquote className="testimonio" key={`${quote.text}-${index}`}>“{quote.text}”<footer>{[quote.localidad, quote.provincia].filter(Boolean).join(", ")}</footer></blockquote>)}</div>
        </section>
        <section className="section wrap center no-print"><div className="card"><h2 className="mt-0" style={{ fontSize: 19 }}>Explorá por distrito</h2><p>Para el detalle de cada provincia, entrá al mapa federal.</p><a className="btn btn-secondary btn-block" href="/mapa">Ver el mapa federal</a></div></section>
      </main>
      <SiteFooter />
    </>
  );
}
