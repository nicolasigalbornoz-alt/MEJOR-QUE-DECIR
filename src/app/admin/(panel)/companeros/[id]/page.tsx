import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMilitant } from "@/app/admin/(panel)/companeros/actions";
import { FlashMessages, TagPill } from "@/components/admin/ListUi";
import { PROVINCES } from "@/data/provinces";
import { MilitantForm } from "@/features/militants/MilitantForm";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { listContactsKnownBy } from "@/lib/data/contacts";
import { getMilitant } from "@/lib/data/militants";
import { listTags } from "@/lib/data/tags";

const errors = {
  invalid: "Revisá nombre, mail y responsabilidades.",
  roles: "Se guardaron los datos, pero no las responsabilidades. Probá de nuevo.",
  "in-use": "No se puede borrar: está vinculado a contactos o actividades. Marcalo como inactivo.",
  save: "No pudimos guardar.",
};

export default async function MilitantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ supabase, access }, { id }, query] = await Promise.all([requireStaff(), params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [militant, roleTags, knownContacts] = await Promise.all([
    getMilitant(supabase, id),
    listTags(supabase, ["responsabilidad"], { includeArchived: true }),
    listContactsKnownBy(supabase, id),
  ]);
  if (!militant) notFound();
  const canEdit = hasRole(access.role, "editor");

  return (
    <section className="wrap">
      <p style={{ marginTop: 20 }}><Link href="/admin/companeros">← Compañeros</Link></p>
      <div className="admin-head">
        <h1>{militant.fullName}</h1>
        {access.role === "admin" && (
          <form action={deleteMilitant}>
            <input type="hidden" name="id" value={militant.id} />
            <button className="btn btn-danger btn-sm" type="submit">Borrar</button>
          </form>
        )}
      </div>
      <FlashMessages error={query.error} saved={query.saved} errors={errors} />
      {militant.source === "padron-2026" && <p className="muted mt-0">Importado del padrón del Encuentro 2026.</p>}

      {canEdit ? <MilitantForm militant={militant} roleTags={roleTags} /> : (
        <div className="card">
          <p><b>Lugar:</b> {[militant.locality, PROVINCES.find((province) => province.id === militant.provinceId)?.name].filter(Boolean).join(", ") || "—"}</p>
          <p><b>Teléfono:</b> {militant.phone || "—"}</p>
          <p><b>Mail:</b> {militant.email || "—"}</p>
          <div className="pill-row" style={{ marginBottom: 12 }}>
            {militant.roles.map((role) => <TagPill key={role.id} name={role.tag.name} color={role.tag.color} detail={role.detail} />)}
          </div>
          {militant.notes && <p style={{ whiteSpace: "pre-wrap" }}>{militant.notes}</p>}
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="mt-0" style={{ fontSize: 18 }}>Contactos que conoce</h2>
        {knownContacts.length ? (
          <ul className="mb-0">
            {knownContacts.map((contact) => (
              <li key={contact.id}>
                <Link href={`/admin/contactos/${contact.id}`}>{contact.name}</Link>
                {contact.type && <> <TagPill name={contact.type.name} color={contact.type.color} /></>}
                {contact.note && <span className="muted"> · {contact.note}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="muted mb-0">No figura como referente de ningún contacto.</p>}
      </div>
    </section>
  );
}
