import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteContact } from "@/app/admin/(panel)/contactos/actions";
import { FlashMessages, TagPill } from "@/components/admin/ListUi";
import { PROVINCES } from "@/data/provinces";
import { ContactForm } from "@/features/contacts/ContactForm";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { getContact } from "@/lib/data/contacts";
import { listTags } from "@/lib/data/tags";

const errors = {
  invalid: "Revisá nombre, mail y referentes.",
  referents: "Se guardaron los datos, pero no los referentes. Probá de nuevo.",
  "in-use": "No se puede borrar: está vinculado a una actividad.",
  save: "No pudimos guardar.",
};

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ supabase, access }, { id }, query] = await Promise.all([requireStaff(), params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [contact, typeTags] = await Promise.all([
    getContact(supabase, id),
    listTags(supabase, ["tipo_contacto"], { includeArchived: true }),
  ]);
  if (!contact) notFound();

  return (
    <section className="wrap">
      <p style={{ marginTop: 20 }}><Link href="/admin/contactos">← Contactos</Link></p>
      <div className="admin-head">
        <h1>{contact.name}</h1>
        {access.role === "admin" && (
          <form action={deleteContact}>
            <input type="hidden" name="id" value={contact.id} />
            <button className="btn btn-danger btn-sm" type="submit">Borrar</button>
          </form>
        )}
      </div>
      <FlashMessages error={query.error} saved={query.saved} errors={errors} />

      {hasRole(access.role, "editor") ? <ContactForm contact={contact} typeTags={typeTags} /> : (
        <div className="card">
          {contact.type && <p><TagPill name={contact.type.name} color={contact.type.color} /></p>}
          {contact.description && <p style={{ whiteSpace: "pre-wrap" }}>{contact.description}</p>}
          <p><b>Referentes:</b></p>
          <ul>
            {contact.referents.map((referent) => (
              <li key={referent.militantId}>
                <Link href={`/admin/companeros/${referent.militantId}`}>{referent.name}</Link>
                {referent.note && ` · ${referent.note}`}{referent.phone && ` · ${referent.phone}`}
              </li>
            ))}
            {!contact.referents.length && <li className="muted">Sin referentes cargados.</li>}
          </ul>
          <p><b>Teléfono:</b> {contact.phone || "—"} · <b>Mail:</b> {contact.email || "—"}</p>
          <p><b>Lugar:</b> {[contact.locality, PROVINCES.find((province) => province.id === contact.provinceId)?.name].filter(Boolean).join(", ") || "—"}</p>
          {contact.notes && <p style={{ whiteSpace: "pre-wrap" }}>{contact.notes}</p>}
        </div>
      )}
    </section>
  );
}
