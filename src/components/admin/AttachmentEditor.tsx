"use client";

import { useState } from "react";
import { acceptAttribute, FILE_RULES, fileExtension, ruleFor, type FileBucket } from "@/features/files/file-types";
import { createClient } from "@/lib/supabase/browser";

export type AttachmentDraft =
  | { id?: string; kind: "file"; title: string; storagePath: string; mimeType: string; sizeBytes: number }
  | { id?: string; kind: "link"; title: string; url: string };

/**
 * Lista editable de adjuntos. Los archivos se suben al bucket privado apenas
 * se eligen; la Server Action verifica cada ruta antes de guardar. Envía el
 * resultado como JSON en el campo `name`.
 */
export function AttachmentEditor({ name, bucket, initial, allowLinks = true }: {
  name: string;
  bucket: FileBucket;
  initial: AttachmentDraft[];
  allowLinks?: boolean;
}) {
  const [items, setItems] = useState<AttachmentDraft[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const rules = FILE_RULES[bucket];

  async function upload(file: File) {
    setMessage("");
    const filename = file.name.split(/[\\/]/).pop() ?? "archivo";
    const extension = fileExtension(filename);
    const kind = ruleFor(bucket, extension);
    if (!kind) return setMessage(`Formato no admitido. Se aceptan: ${rules.label}.`);
    if (file.size < 1 || file.size > rules.maxBytes) return setMessage(`El archivo supera el máximo: ${rules.label}.`);
    const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    if (!kind.matches(header)) return setMessage("El contenido del archivo no coincide con su extensión.");

    setUploading(true);
    const storagePath = `${crypto.randomUUID()}/${crypto.randomUUID()}.${extension === "jpeg" ? "jpg" : extension}`;
    const { error } = await createClient().storage.from(bucket).upload(storagePath, file, { contentType: kind.mime, upsert: false });
    setUploading(false);
    if (error) return setMessage("No se pudo subir el archivo. Probá de nuevo.");

    setItems((current) => [...current, {
      kind: "file",
      title: filename.replace(/\.[^.]+$/, "").slice(0, 200) || "Archivo",
      storagePath,
      mimeType: kind.mime,
      sizeBytes: file.size,
    }]);
  }

  async function remove(index: number) {
    const item = items[index];
    // Un archivo recién subido y todavía no guardado se borra ya; los
    // guardados se quitan del bucket al guardar la ficha.
    if (item.kind === "file" && !item.id) await createClient().storage.from(bucket).remove([item.storagePath]);
    setItems((current) => current.filter((_, position) => position !== index));
  }

  function addLink() {
    const url = linkUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return setMessage("El link tiene que empezar con http:// o https://");
    setItems((current) => [...current, { kind: "link", title: linkTitle.trim().slice(0, 200) || url.slice(0, 200), url }]);
    setLinkTitle("");
    setLinkUrl("");
    setMessage("");
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      {items.map((item, index) => (
        <div className="repeat-row" key={item.kind === "file" ? item.storagePath : `${item.url}-${index}`}>
          <input className="input" value={item.title} maxLength={200} aria-label="Título del adjunto"
            onChange={(event) => setItems((current) => current.map((other, position) => position === index ? { ...other, title: event.target.value } : other))} />
          <span className="small muted">
            {item.kind === "file" ? `Archivo · ${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB` : item.url}
          </span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => void remove(index)}>Quitar</button>
        </div>
      ))}
      <div className="field" style={{ marginTop: 8 }}>
        <label className="field-label" htmlFor={`${name}-file`}>Subir archivo: {rules.label}</label>
        <input className="input" id={`${name}-file`} type="file" accept={acceptAttribute(bucket)} disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }} />
        {uploading && <p className="muted">Subiendo…</p>}
      </div>
      {allowLinks && (
        <div className="repeat-row">
          <input className="input" value={linkTitle} maxLength={200} placeholder="Título del link" aria-label="Título del link" onChange={(event) => setLinkTitle(event.target.value)} />
          <input className="input" value={linkUrl} maxLength={2000} placeholder="https://…" aria-label="URL" type="url" onChange={(event) => setLinkUrl(event.target.value)} />
          <button className="btn btn-secondary btn-sm" type="button" onClick={addLink}>Agregar link</button>
        </div>
      )}
      {message && <p className="field-error" style={{ display: "block" }} role="alert">{message}</p>}
    </div>
  );
}
