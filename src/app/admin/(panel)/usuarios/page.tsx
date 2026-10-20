import { changeStaffRole, inviteStaff, removeStaff } from "@/app/admin/(panel)/usuarios/actions";
import { requireStaff } from "@/lib/auth/require-staff";
import { STAFF_ROLE_LABELS, type StaffRole } from "@/lib/auth/staff";

const errorMessages: Record<string, string> = {
  invalid: "Revisá el correo y el rol.",
  service: "Falta configurar SUPABASE_SERVICE_ROLE_KEY en el servidor para enviar invitaciones.",
  exists: "Ya existe una cuenta con ese correo.",
  invite: "No pudimos enviar la invitación.",
  "rate-limit": "Supabase alcanzó el límite de mails por hora. Esperá un rato o configurá un SMTP propio en Supabase.",
  email: "Supabase no acepta ese correo como válido.",
  save: "No pudimos guardar el cambio.",
  "last-admin": "Tiene que quedar al menos una cuenta administradora.",
  self: "No podés quitarte el acceso a vos mismo.",
};

const savedMessages: Record<string, string> = {
  invited: "Invitación enviada.",
  role: "Rol actualizado.",
  removed: "Acceso quitado.",
};

const ROLES = Object.entries(STAFF_ROLE_LABELS) as [StaffRole, string][];

const ROLE_HELP: Record<StaffRole, string> = {
  admin: "todo, incluido borrar y gestionar usuarios",
  editor: "carga y edita en todas las secciones",
  viewer: "solo consulta",
};

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ supabase, access }, query] = await Promise.all([requireStaff("admin"), searchParams]);
  const { data: members, error } = await supabase
    .from("staff_members")
    .select("user_id,role,display_name,email,created_at")
    .order("created_at");

  return (
    <section className="wrap">
      <div className="admin-head"><h1>Usuarios</h1></div>
      {query.error && <p className="form-msg is-visible error" role="alert">{errorMessages[query.error] ?? errorMessages.save}</p>}
      {query.saved && <p className="form-msg is-visible success" role="status">{savedMessages[query.saved] ?? "Guardado."}</p>}

      <div className="card">
        <h2 className="mt-0" style={{ fontSize: 18 }}>Invitar</h2>
        <p className="muted">La persona recibe un mail para elegir su contraseña.</p>
        <form action={inviteStaff} className="form-grid">
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
              {ROLES.map(([value, label]) => <option key={value} value={value}>{label}: {ROLE_HELP[value]}</option>)}
            </select>
          </div>
          <div className="span-2"><button className="btn btn-primary" type="submit">Enviar invitación</button></div>
        </form>
      </div>

      <h2 style={{ fontSize: 18, marginTop: 28 }}>Equipo</h2>
      {error ? <p className="muted">No se pudo cargar el equipo. Revisá que la migración de roles esté aplicada.</p> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              {members?.map((member) => (
                <tr key={member.user_id}>
                  <td>{member.display_name || "—"}</td>
                  <td>{member.email}</td>
                  <td>
                    <form action={changeStaffRole} style={{ display: "flex", gap: 6 }}>
                      <input type="hidden" name="userId" value={member.user_id} />
                      <select className="select" name="role" defaultValue={member.role} aria-label={`Rol de ${member.email}`}>
                        {ROLES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                      <button className="btn btn-ghost btn-sm" type="submit">Cambiar</button>
                    </form>
                  </td>
                  <td>
                    {member.user_id !== access.userId && (
                      <form action={removeStaff}>
                        <input type="hidden" name="userId" value={member.user_id} />
                        <button className="btn btn-danger btn-sm" type="submit">Quitar acceso</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
