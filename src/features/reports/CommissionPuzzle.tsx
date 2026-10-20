"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { COMMISSIONS } from "@/features/forms/catalogs";
import type { PublicAct } from "@/lib/data/acts";
import type { PublicReport } from "@/features/reports/types";

const COLORS = ["--seq-250", "--seq-300", "--seq-350", "--seq-400", "--seq-450", "--seq-500", "--seq-550", "--seq-600", "--seq-650"];
const JOINT_H = [[true, false], [false, true], [true, false]];
const JOINT_V = [[false, true], [true, false], [false, true]];
const SITUATION: Record<number, string> = { 1: "Muy mala", 2: "Mala", 3: "Regular", 4: "Buena", 5: "Muy buena" };
const VISION: Record<number, string> = { [-2]: "Muy pesimista", [-1]: "Pesimista", 0: "Neutral", 1: "Optimista", 2: "Muy optimista" };

function shape(row: number, column: number) {
  const edge = (type: "flat" | "tab" | "notch", a: string, b: string, end: string) =>
    type === "flat" ? `L${end}` : `L${a} A15,15 0 0,${type === "tab" ? 1 : 0} ${b} L${end}`;
  const top = row === 0 ? "flat" : JOINT_V[column][row - 1] ? "notch" : "tab";
  const bottom = row === 2 ? "flat" : JOINT_V[column][row] ? "tab" : "notch";
  const left = column === 0 ? "flat" : JOINT_H[row][column - 1] ? "notch" : "tab";
  const right = column === 2 ? "flat" : JOINT_H[row][column] ? "tab" : "notch";
  return [
    "M0,0",
    edge(top as "flat" | "tab" | "notch", "35,0", "65,0", "100,0"),
    edge(right as "flat" | "tab" | "notch", "100,35", "100,65", "100,100"),
    edge(bottom as "flat" | "tab" | "notch", "65,100", "35,100", "0,100"),
    edge(left as "flat" | "tab" | "notch", "0,65", "0,35", "0,0"),
    "Z",
  ].join(" ");
}

function BarList({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!entries.length) return <p className="empty-note">Todavía no hay datos suficientes.</p>;
  const maximum = Math.max(...entries.map(([, count]) => count), 1);
  return <ul className="bar-list">{entries.map(([label, count]) => <li className="bar-row" key={label}><div className="bar-row__top"><span className="label">{label}</span><span className="value">{count}</span></div><div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(6, count / maximum * 100)}%` }} /></div></li>)}</ul>;
}

export function CommissionPuzzle({ report, acts }: { report: PublicReport; acts: PublicAct[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? COMMISSIONS.find((commission) => commission.id === selectedId) : null;
  const selectedStats = selectedId ? report.byCommission[selectedId] : null;
  const selectedAct = selectedId ? acts.find((act) => act.commission_id === selectedId) : null;

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedId(null); };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [selectedId]);

  return (
    <>
      <div className="puzzle-grid">
        {COMMISSIONS.map((commission, index) => {
          const stat = report.byCommission[commission.id];
          const row = Math.floor(index / 3);
          const column = index % 3;
          return (
            <button className="puzzle-piece" type="button" key={commission.id} onClick={() => setSelectedId(commission.id)} aria-label={`Ver desglose de ${commission.name}`}>
              <svg viewBox="0 0 100 100" aria-hidden="true"><path d={shape(row, column)} fill={`var(${COLORS[index]})`} /></svg>
              <span className="puzzle-piece__label"><b>{commission.name}</b><small className={!stat?.count ? "is-empty" : undefined}>{stat?.count ? `${stat.count} ${stat.count === 1 ? "respuesta" : "respuestas"}` : "Sin datos todavía"}</small></span>
            </button>
          );
        })}
      </div>
      {selected && <>
        <button className="sheet-backdrop is-open" type="button" aria-label="Cerrar desglose" onClick={() => setSelectedId(null)} />
        <section className="sheet is-open" role="dialog" aria-modal="true" aria-label={`Desglose de ${selected.name}`}>
          <div className="sheet__handle" />
          <button className="sheet__close" type="button" aria-label="Cerrar" onClick={() => setSelectedId(null)}>×</button>
          <div className="sheet__body" id="sheetBody">
            <h3>{selected.name}</h3>
            {selectedStats?.count ? <>
              <div className="stat-row" style={{ margin: "14px 0 18px" }}>
                <div className="stat"><b>{selectedStats.count}</b><span>Interesados/as</span></div>
                <div className="stat"><b className="stat-text">{selectedStats.situacionN ? SITUATION[Math.round(selectedStats.situacionSum / selectedStats.situacionN)] : "Sin datos"}</b><span>Situación</span></div>
                <div className="stat"><b className="stat-text">{selectedStats.visionN ? VISION[Math.round(selectedStats.visionSum / selectedStats.visionN)] : "Sin datos"}</b><span>Visión país</span></div>
              </div>
              <h4>Problemas que más mencionan</h4><BarList values={selectedStats.problemas} />
              <h4>Necesidades que más mencionan</h4><BarList values={selectedStats.necesidades} />
              {selectedStats.quotes.length > 0 && <><h4>En sus palabras</h4>{selectedStats.quotes.map((quote, index) => <blockquote className="testimonio" key={`${quote.text}-${index}`}>“{quote.text}”<footer>{[quote.localidad, quote.provincia].filter(Boolean).join(", ")}</footer></blockquote>)}</>}
            </> : <p className="empty-note">Todavía nadie eligió esta comisión en las respuestas del formulario.</p>}
            <h4>Resumen del acta</h4>
            {selectedAct ? <>
              <p className="acta-resumen">{selectedAct.summary}</p>
              {selectedAct.public_document_path && <p><Link className="btn btn-ghost" href={`/api/actas/${selectedAct.id}/document`}>Descargar acta (Word)</Link></p>}
            </> : <p className="empty-note">Todavía no se cargó el resumen de esta comisión.</p>}
          </div>
        </section>
      </>}
    </>
  );
}
