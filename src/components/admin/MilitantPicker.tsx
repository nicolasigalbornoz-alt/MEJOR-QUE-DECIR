"use client";

import { useEffect, useState } from "react";
import { findMilitants } from "@/app/admin/(panel)/companeros/actions";

export type PickedMilitant = { id: string; label: string; note: string };

/**
 * Selector de compañeros para otros formularios. Envía `${name}Id` y
 * `${name}Note` como listas paralelas.
 */
export function MilitantPicker({ name, initial, noteLabel, noteMax = 200 }: {
  name: string;
  initial: PickedMilitant[];
  noteLabel?: string;
  noteMax?: number;
}) {
  const [picked, setPicked] = useState<PickedMilitant[]>(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const found = await findMilitants(term);
      if (!cancelled) setResults(found);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const visibleResults = query.trim().length < 2 ? [] : results.filter((result) => !picked.some((item) => item.id === result.id));

  return (
    <div>
      {picked.map((item) => (
        <div className="repeat-row" key={item.id}>
          <input type="hidden" name={`${name}Id`} value={item.id} />
          <div><b>{item.label}</b></div>
          {noteLabel ? (
            <input className="input" name={`${name}Note`} maxLength={noteMax} placeholder={noteLabel} aria-label={`${noteLabel} (${item.label})`}
              value={item.note} onChange={(event) => setPicked((current) => current.map((other) => other.id === item.id ? { ...other, note: event.target.value } : other))} />
          ) : <input type="hidden" name={`${name}Note`} value="" />}
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setPicked((current) => current.filter((other) => other.id !== item.id))}>Quitar</button>
        </div>
      ))}
      <div className="autocomplete">
        <input className="input" type="search" value={query} placeholder="Buscar compañero por nombre…" aria-label="Buscar compañero"
          onChange={(event) => setQuery(event.target.value)} />
        {visibleResults.length > 0 && (
          <ul className="autocomplete__list" role="listbox">
            {visibleResults.map((result) => (
              <li key={result.id} className="autocomplete__item" role="option" aria-selected="false"
                onMouseDown={(event) => {
                  event.preventDefault();
                  setPicked((current) => [...current, { ...result, note: "" }]);
                  setQuery("");
                }}>
                {result.label}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
