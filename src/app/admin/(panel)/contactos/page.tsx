import Link from "next/link";
import { FlashMessages, Pager, TagPill } from "@/components/admin/ListUi";
import { PROVINCES } from "@/data/provinces";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { listContacts, type ContactFilters } from "@/lib/data/contacts";
import { parsePage } from "@/lib/data/listing";
import { listTags } from "@/lib/data/tags";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<ContactFilters & { page?: string; error?: string; saved?: string }>;
}) {
  const [{ supabase, access }, query] = await Promise.all([requireStaff(), searchParams]);
  const page = parsePage(query.page);
  const filters: ContactFilters = { q: query.q, tipo: query.tipo, provincia: query.provincia };
  const [{ items, total }, typeTags] = await Promise.all([
    listContacts(supabase, filters, page),
    listTags(supabase, ["tipo_contacto"], { includeArchived: true }),
  ]);

  return (
    <section className="wrap">
      <div className="admin-head">
        <h1>Contactos</h1>
        {hasRole(access.role, "editor") && <Link className="btn btn-primary" href="/admin/contactos/nuevo">Nuevo contacto</Link>}
      </div>
      <FlashMessages error={query.error} saved={query.saved} errors={{ invalid: "Datos inválidos." }} />

      <form className="admin-toolbar" method="get">
        <div className="field">
          <label className="field-label" htmlFor="q">Buscar</label>
          <input className="input" id="q" name="q" defaultValue={query.q} placeholder="Nombre, descripción o localidad" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tipo">Tipo</label>
          <select className="select" id="tipo" name="tipo" defaultValue={query.tipo ?? ""}>
            <option value="">Todos</option>
            {typeTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="provincia">Provincia</label>
          <select className="select" id="provincia" name="provincia" defaultValue={query.provincia ?? ""}>
            <option value="">Todas</option>
            {PROVINCES.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary" type="submit">Filtrar</button>
      </form>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Qué es / qué hace</th><th>Referentes</th></tr></thead>
          <tbody>
            {items.map((contact) => (
              <tr key={contact.id}>
                <td><Link href={`/admin/contactos/${contact.id}`}>{contact.name}</Link></td>
                <td>{contact.type ? <TagPill name={contact.type.name} color={contact.type.color} archived={contact.type.archived} /> : "—"}</td>
                <td className="small">{contact.description.length > 140 ? `${contact.description.slice(0, 140)}…` : contact.description || "—"}</td>
                <td className="small">{contact.referents.map((referent) => referent.name).join(", ") || "—"}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="muted">No hay contactos con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager basePath="/admin/contactos" params={filters} page={page} total={total} />
    </section>
  );
}
