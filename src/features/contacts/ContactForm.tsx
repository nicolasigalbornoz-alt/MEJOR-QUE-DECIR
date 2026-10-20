import Link from "next/link";
import { saveContact } from "@/app/admin/(panel)/contactos/actions";
import { MilitantPicker } from "@/components/admin/MilitantPicker";
import { PROVINCES } from "@/data/provinces";
import type { Tag } from "@/features/tags/categories";
import type { Contact } from "@/lib/data/contacts";

export function ContactForm({ contact, typeTags }: { contact?: Contact; typeTags: Tag[] }) {
  const options = typeTags.filter((tag) => !tag.archived || tag.id === contact?.typeTagId);

  return (
    <form action={saveContact} className="card">
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <div className="form-grid">
        <div className="field">
          <label className="field-label" htmlFor="name">Nombre</label>
          <input className="input" id="name" name="name" defaultValue={contact?.name} maxLength={200} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="typeTagId">Tipo</label>
          <select className="select" id="typeTagId" name="typeTagId" defaultValue={contact?.typeTagId ?? ""}>
            <option value="">Sin tipo</option>
            {options.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
          <p className="muted mb-0">Los tipos se editan en <Link href="/admin/etiquetas#tipo_contacto">Etiquetas</Link>.</p>
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="description">Qué es o qué hace</label>
          <textarea className="textarea" id="description" name="description" defaultValue={contact?.description} maxLength={4000} rows={3} />
        </div>
        <div className="field span-2">
          <span className="field-label">Referentes de Jóvenes FR que lo conocen</span>
          <MilitantPicker
            name="referent"
            noteLabel="Vínculo (opcional)"
            initial={contact?.referents.map((referent) => ({ id: referent.militantId, label: referent.name, note: referent.note })) ?? []}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="phone">Teléfono directo (opcional)</label>
          <input className="input" id="phone" name="phone" type="tel" defaultValue={contact?.phone} maxLength={60} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="email">Mail directo (opcional)</label>
          <input className="input" id="email" name="email" type="email" defaultValue={contact?.email} maxLength={254} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="provinceId">Provincia</label>
          <select className="select" id="provinceId" name="provinceId" defaultValue={contact?.provinceId ?? ""}>
            <option value="">Sin dato</option>
            {PROVINCES.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="locality">Localidad</label>
          <input className="input" id="locality" name="locality" defaultValue={contact?.locality} maxLength={200} />
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="notes">Notas internas</label>
          <textarea className="textarea" id="notes" name="notes" defaultValue={contact?.notes} maxLength={4000} rows={3} />
        </div>
      </div>
      <button className="btn btn-primary" type="submit">Guardar</button>
    </form>
  );
}
