"use client";

import { useState } from "react";
import { createTagQuick } from "@/app/admin/(panel)/etiquetas/actions";
import { TAG_CATEGORIES, type Tag, type TagCategory } from "@/features/tags/categories";

/**
 * Selección múltiple de etiquetas de una o más categorías. Envía `name` como
 * lista de ids. Un editor puede crear una etiqueta nueva sin salir del formulario.
 */
export function TagPicker({ name, categories, tags, selected, canCreate }: {
  name: string;
  categories: TagCategory[];
  tags: Tag[];
  selected: string[];
  canCreate: boolean;
}) {
  const [available, setAvailable] = useState(tags);
  const [checked, setChecked] = useState(new Set(selected));
  const [drafts, setDrafts] = useState<Partial<Record<TagCategory, string>>>({});
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function create(category: TagCategory) {
    const draft = (drafts[category] ?? "").trim();
    if (!draft) return;
    setMessage("");
    const result = await createTagQuick(category, draft);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setAvailable((current) => [...current, result.tag]);
    setChecked((current) => new Set(current).add(result.tag.id));
    setDrafts((current) => ({ ...current, [category]: "" }));
  }

  return (
    <div>
      {categories.map((category) => {
        // Las archivadas solo se muestran si ya estaban elegidas.
        const items = available.filter((tag) => tag.category === category && (!tag.archived || checked.has(tag.id)));
        return (
          <div key={category} style={{ marginBottom: 12 }}>
            {categories.length > 1 && <p className="small mb-0" style={{ marginBottom: 6 }}><b>{TAG_CATEGORIES[category].label}</b></p>}
            <div className="check-grid">
              {items.map((tag) => (
                <label key={tag.id} style={{ borderColor: checked.has(tag.id) ? tag.color : undefined }}>
                  <input type="checkbox" name={name} value={tag.id} checked={checked.has(tag.id)} onChange={() => toggle(tag.id)} />
                  <span>{tag.name}</span>
                </label>
              ))}
              {!items.length && <span className="muted">Sin etiquetas todavía.</span>}
            </div>
            {canCreate && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input className="input" value={drafts[category] ?? ""} maxLength={80} placeholder="Nueva etiqueta"
                  aria-label={`Nueva etiqueta en ${TAG_CATEGORIES[category].label}`}
                  onChange={(event) => setDrafts((current) => ({ ...current, [category]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void create(category);
                    }
                  }} />
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => void create(category)}>Crear</button>
              </div>
            )}
          </div>
        );
      })}
      {message && <p className="field-error" style={{ display: "block" }} role="alert">{message}</p>}
    </div>
  );
}
