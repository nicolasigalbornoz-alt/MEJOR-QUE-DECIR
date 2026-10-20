"use client";

import { useRef, useState, type FormEvent } from "react";
import { saveCommissionAct } from "@/app/admin/(panel)/actas/actions";
import { createClient } from "@/lib/supabase/browser";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MIME = {
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

type CommissionOption = { id: string; name: string };

export function ActUploadForm({ commissions }: { commissions: CommissionOption[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [commissionId, setCommissionId] = useState("");
  const [summary, setSummary] = useState("");
  const [documentPublic, setDocumentPublic] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);
    if (!commissionId || !summary.trim() || !file) {
      setMessage("Elegí una comisión, un archivo Word y escribí el resumen público.");
      return;
    }
    if (file.size < 1 || file.size > MAX_FILE_BYTES) {
      setMessage("El archivo debe pesar entre 1 byte y 8 MB.");
      return;
    }

    const filename = file.name.split(/[\\/]/).pop() ?? "acta.docx";
    const extension = filename.toLowerCase().split(".").pop();
    if (extension !== "doc" && extension !== "docx") {
      setMessage("Solo se aceptan documentos .doc o .docx.");
      return;
    }
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const validWord = extension === "docx"
      ? header[0] === 0x50 && header[1] === 0x4b
      : header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0;
    if (!validWord) {
      setMessage("El archivo no tiene la firma esperada de Word.");
      return;
    }

    setPending(true);
    const mimeType = MIME[extension];
    const storagePath = `${commissionId}/${crypto.randomUUID()}/${crypto.randomUUID()}.${extension}`;
    try {
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from("commission-acts").upload(storagePath, file, {
        contentType: mimeType,
        upsert: false,
      });
      if (uploadError) throw new Error("No se pudo subir el documento a Storage.");

      const result = await saveCommissionAct({
        commissionId,
        summary: summary.trim(),
        storagePath,
        originalFilename: filename.slice(0, 255),
        mimeType,
        fileSizeBytes: file.size,
        documentPublic,
      });
      if (!result.ok) {
        await supabase.storage.from("commission-acts").remove([storagePath]);
        throw new Error(result.error);
      }

      setSuccess(true);
      setMessage("Acta guardada. El resumen ya está disponible en la síntesis.");
      setCommissionId("");
      setSummary("");
      setDocumentPublic(false);
      setFile(null);
      formRef.current?.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos guardar el acta.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      <div className="field"><label className="field-label" htmlFor="commissionId">Comisión</label><div className="select-wrap"><select className="select" id="commissionId" value={commissionId} onChange={(event) => setCommissionId(event.target.value)} required><option value="">Elegí una comisión…</option>{commissions.map((commission) => <option key={commission.id} value={commission.id}>{commission.name}</option>)}</select></div></div>
      <div className="field"><label className="field-label" htmlFor="document">Documento Word (hasta 8 MB)</label><input className="input" id="document" type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></div>
      <div className="field"><label className="field-label" htmlFor="summary">Resumen público (hasta 2.000 caracteres)</label><textarea className="textarea" id="summary" value={summary} onChange={(event) => setSummary(event.target.value.slice(0, 2000))} maxLength={2000} required /><div className="field-counter">{summary.length}/2000</div></div>
      <label className="option-card"><input type="checkbox" checked={documentPublic} onChange={(event) => setDocumentPublic(event.target.checked)} /><span className="option-card__label">Permitir que cualquier visitante descargue el documento</span></label>
      <div className="survey-submit"><button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Subiendo…" : "Guardar acta"}</button></div>
      {message && <p className={`form-msg is-visible ${success ? "success" : "error"}`} role="status">{message}</p>}
    </form>
  );
}
