import { saveLibraryItem } from "@/app/admin/(panel)/formacion/actions";
import { AttachmentEditor, type AttachmentDraft } from "@/components/admin/AttachmentEditor";
import { TagPicker } from "@/components/admin/TagPicker";
import type { Tag } from "@/features/tags/categories";
import type { LibraryItem } from "@/lib/data/library";

export function LibraryForm({ item, tags }: { item?: LibraryItem; tags: Tag[] }) {
  const source: AttachmentDraft[] = !item ? [] : item.storagePath
    ? [{ id: item.id, kind: "file", title: item.title, storagePath: item.storagePath, mimeType: item.mimeType ?? "", sizeBytes: item.sizeBytes ?? 1 }]
    : item.externalUrl ? [{ id: item.id, kind: "link", title: item.title, url: item.externalUrl }] : [];

  return (
    <form action={saveLibraryItem} className="card">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="form-grid">
        <div className="field span-2">
          <label className="field-label" htmlFor="title">Título</label>
          <input className="input" id="title" name="title" defaultValue={item?.title} maxLength={250} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="author">Autor/a</label>
          <input className="input" id="author" name="author" defaultValue={item?.author} maxLength={200} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="year">Año</label>
          <input className="input" id="year" name="year" type="number" min={1500} max={2100} defaultValue={item?.year ?? ""} />
        </div>
        <div className="field span-2">
          <span className="field-label">Archivo o link</span>
          <p className="muted mt-0">Subí el PDF o EPUB, o pegá un link si es más pesado o ya está en Drive.</p>
          <AttachmentEditor name="source" bucket="library" initial={source} max={1} showTitles={false} />
        </div>
        <div className="field span-2">
          <span className="field-label">Temas</span>
          <TagPicker name="tagIds" categories={["tema_formacion"]} tags={tags} selected={item?.tags.map((tag) => tag.id) ?? []} canCreate />
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="description">Descripción</label>
          <textarea className="textarea" id="description" name="description" defaultValue={item?.description} maxLength={4000} rows={4} />
        </div>
      </div>
      <button className="btn btn-primary" type="submit">Guardar</button>
    </form>
  );
}
