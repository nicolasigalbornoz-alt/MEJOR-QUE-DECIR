"use client";

import { useRef, useState } from "react";

type Option = { id: string; name: string };
type Row = { key: number; tagId: string; detail: string };

export function RoleRows({ options, initial }: { options: Option[]; initial: { tagId: string; detail: string }[] }) {
  const start = initial.length ? initial : [{ tagId: "", detail: "" }];
  const [rows, setRows] = useState<Row[]>(() => start.map((row, index) => ({ ...row, key: index })));
  const nextKey = useRef(start.length);

  function update(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <div>
      {rows.map((row) => (
        <div className="repeat-row" key={row.key}>
          <div className="field mb-0">
            <label className="field-label" htmlFor={`role-tag-${row.key}`}>Responsabilidad</label>
            <select className="select" id={`role-tag-${row.key}`} name="roleTag" value={row.tagId} onChange={(event) => update(row.key, { tagId: event.target.value })}>
              <option value="">Elegir…</option>
              {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </div>
          <div className="field mb-0">
            <label className="field-label" htmlFor={`role-detail-${row.key}`}>Detalle (opcional)</label>
            <input className="input" id={`role-detail-${row.key}`} name="roleDetail" maxLength={200} value={row.detail}
              placeholder="Ej.: Comisión de Educación" onChange={(event) => update(row.key, { detail: event.target.value })} />
          </div>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}>
            Quitar
          </button>
        </div>
      ))}
      <button className="btn btn-secondary btn-sm" type="button" onClick={() => setRows((current) => [...current, { key: nextKey.current++, tagId: "", detail: "" }])}>
        + Agregar responsabilidad
      </button>
    </div>
  );
}
