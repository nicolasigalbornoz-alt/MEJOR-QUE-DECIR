import { findMilitants } from "@/app/admin/(panel)/companeros/actions";
import { findContacts } from "@/app/admin/(panel)/contactos/actions";
import { saveActivity } from "@/app/admin/(panel)/insumos/actions";
import { AttachmentEditor, type AttachmentDraft } from "@/components/admin/AttachmentEditor";
import { EntityPicker } from "@/components/admin/EntityPicker";
import { TagPicker } from "@/components/admin/TagPicker";
import type { Tag } from "@/features/tags/categories";
import type { Activity } from "@/lib/data/activities";

export function ActivityForm({ activity, tags }: { activity?: Activity; tags: Tag[] }) {
  const attachments: AttachmentDraft[] = activity?.attachments.map((item) => item.kind === "file"
    ? { id: item.id, kind: "file", title: item.title, storagePath: item.storagePath, mimeType: item.mimeType, sizeBytes: item.sizeBytes }
    : { id: item.id, kind: "link", title: item.title, url: item.url }) ?? [];
  const person = (kind: "militant" | "contact") => activity?.people
    .filter((item) => item.kind === kind)
    .map((item) => ({ id: item.refId, label: item.name, note: item.note })) ?? [];

  return (
    <form action={saveActivity} className="card">
      {activity && <input type="hidden" name="id" value={activity.id} />}
      <div className="field">
        <label className="field-label" htmlFor="title">Nombre de la actividad</label>
        <input className="input" id="title" name="title" defaultValue={activity?.title} maxLength={200} required placeholder="Ej.: Liga de debate" />
      </div>
      <div className="field">
        <span className="field-label">Orientado a y tags</span>
        <TagPicker name="tagIds" categories={["publico", "actividad"]} tags={tags}
          selected={activity?.tags.map((tag) => tag.id) ?? []} canCreate />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="description">Descripción</label>
        <textarea className="textarea" id="description" name="description" defaultValue={activity?.description} maxLength={6000} rows={4} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="purpose">Utilidad o finalidad</label>
        <textarea className="textarea" id="purpose" name="purpose" defaultValue={activity?.purpose} maxLength={4000} rows={3} />
      </div>
      <div className="field">
        <span className="field-label">Procedimiento para armarla: documentos y links</span>
        <AttachmentEditor name="attachments" bucket="activity-files" initial={attachments} />
      </div>
      <div className="field">
        <label className="field-label" htmlFor="procedure">Procedimiento en texto (opcional)</label>
        <textarea className="textarea" id="procedure" name="procedure" defaultValue={activity?.procedure} maxLength={20000} rows={6}
          placeholder="Pasos, materiales, tiempos… si no está todo en el documento adjunto." />
      </div>
      <div className="field">
        <span className="field-label">Quiénes la hicieron: compañeros</span>
        <EntityPicker name="doerMilitant" search={findMilitants} placeholder="Buscar compañero…" noteLabel="Rol o lugar (opcional)" initial={person("militant")} />
      </div>
      <div className="field">
        <span className="field-label">Quiénes la hicieron: contactos</span>
        <EntityPicker name="doerContact" search={findContacts} placeholder="Buscar contacto…" noteLabel="Rol o lugar (opcional)" initial={person("contact")} />
      </div>
      <button className="btn btn-primary" type="submit">Guardar</button>
    </form>
  );
}
