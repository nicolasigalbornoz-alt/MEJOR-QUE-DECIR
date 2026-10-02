"use client";

export function PrintButton() {
  return <button className="btn btn-ghost no-print" type="button" onClick={() => window.print()}>Descargar / imprimir</button>;
}
