"use client";

import { useActionState, useState } from "react";
import { inviteStaff, type InviteState } from "@/app/admin/(panel)/usuarios/actions";

export function InviteForm({ roles }: { roles: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(inviteStaff, { status: "idle" });
  const [copied, setCopied] = useState(false);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <form action={action} className="form-grid" onSubmit={() => setCopied(false)}>
        <div className="field">
          <label className="field-label" htmlFor="invite-email">Correo</label>
          <input className="input" id="invite-email" name="email" type="email" maxLength={254} required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="invite-name">Nombre</label>
          <input className="input" id="invite-name" name="displayName" maxLength={120} />
        </div>
        <div className="field span-2">
          <label className="field-label" htmlFor="invite-role">Rol</label>
          <select className="select" id="invite-role" name="role" defaultValue="editor">
            {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
        </div>
        <div className="span-2" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="btn btn-primary" type="submit" name="mode" value="link" disabled={pending}>Generar enlace</button>
          <button className="btn btn-ghost" type="submit" name="mode" value="email" disabled={pending}>Enviar por mail</button>
        </div>
      </form>

      {pending && <p className="muted">Procesando…</p>}
      {state.status === "error" && <p className="form-msg is-visible error" role="alert">{state.message}</p>}
      {state.status === "sent" && <p className="form-msg is-visible success" role="status">{state.message}</p>}
      {state.status === "link" && (
        <div className="form-msg is-visible success" role="status">
          <p className="mt-0">{state.message}</p>
          <input className="input" readOnly value={state.link} aria-label="Enlace de invitación" onFocus={(event) => event.target.select()} />
          <button className="btn btn-secondary btn-sm" type="button" style={{ marginTop: 8 }} onClick={() => void copy(state.link)}>
            {copied ? "Copiado" : "Copiar enlace"}
          </button>
        </div>
      )}
    </>
  );
}
