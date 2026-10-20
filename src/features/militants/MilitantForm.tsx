import { PROVINCES } from "@/data/provinces";
import { saveMilitant } from "@/app/admin/(panel)/companeros/actions";
import { RoleRows } from "@/features/militants/RoleRows";
import type { Tag } from "@/features/tags/categories";
import type { Militant } from "@/lib/data/militants";

export function MilitantForm({ militant, roleTags }: { militant?: Militant; roleTags: Tag[] }) {
  // Una etiqueta archivada que ya tiene asignada sigue apareciendo para no perderla al guardar.
  const assigned = new Set(militant?.roles.map((role) => role.tagId));
  const options = roleTags
    .filter((tag) => !tag.archived || assigned.has(tag.id))
    .map((tag) => ({ id: tag.id, name: tag.archived ? `${tag.name} (archivada)` : tag.name }));

  return (
    <form action={saveMilitant} className="card">
      {militant && <input type="hidden" name="id" value={militant.id} />}
      <div className="form-grid">
        <div className="field span-2">
          <label className="field-label" htmlFor="fullName">Nombre y apellido</label>
          <input className="input" id="fullName" name="fullName" defaultValue={militant?.fullName} maxLength={200} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="provinceId">Provincia</label>
          <select className="select" id="provinceId" name="provinceId" defaultValue={militant?.provinceId ?? ""}>
            <option value="">Sin dato</option>
            {PROVINCES.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="locality">Localidad</label>
          <input className="input" id="locality" name="locality" defaultValue={militant?.locality} maxLength={200} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="phone">Teléfono</label>
          <input className="input" id="phone" name="phone" type="tel" defaultValue={militant?.phone} maxLength={60} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="email">Mail</label>
          <input className="input" id="email" name="email" type="email" defaultValue={militant?.email} maxLength={254} />
        </div>
        <div className="field span-2">
          <span className="field-label">Responsabilidades</span>
          <RoleRows options={options} initial={militant?.roles.map((role) => ({ tagId: role.tagId, detail: role.detail })) ?? []} />
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="notes">Notas internas</label>
          <textarea className="textarea" id="notes" name="notes" defaultValue={militant?.notes} maxLength={4000} rows={4} />
        </div>
        <div className="field span-2">
          <label className="small">
            <input type="checkbox" name="active" value="true" defaultChecked={militant?.active ?? true} /> Activo/a
          </label>
        </div>
      </div>
      <button className="btn btn-primary" type="submit">Guardar</button>
    </form>
  );
}
