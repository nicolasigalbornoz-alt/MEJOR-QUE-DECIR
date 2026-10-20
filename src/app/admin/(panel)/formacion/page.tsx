import Link from "next/link";
import { FlashMessages, Pager, TagPill } from "@/components/admin/ListUi";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { listLibrary, type LibraryFilters } from "@/lib/data/library";
import { parsePage } from "@/lib/data/listing";
import { listTags } from "@/lib/data/tags";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<LibraryFilters & { page?: string; error?: string; saved?: string }>;
}) {
  const [{ supabase, access }, query] = await Promise.all([requireStaff(), searchParams]);
  const page = parsePage(query.page);
  const filters: LibraryFilters = { q: query.q, tema: query.tema };
  const [{ items, total }, tags] = await Promise.all([
    listLibrary(supabase, filters, page),
    listTags(supabase, ["tema_formacion"], { includeArchived: true }),
  ]);

  return (
    <section className="wrap">
      <div className="admin-head">
        <h1>Formación</h1>
        {hasRole(access.role, "editor") && <Link className="btn btn-primary" href="/admin/formacion/nuevo">Agregar material</Link>}
      </div>
      <p className="muted mt-0">Libros y PDFs para la formación política. Solo los ve el equipo del panel.</p>
      <FlashMessages error={query.error} saved={query.saved} errors={{ invalid: "Datos inválidos." }} />

      <form className="admin-toolbar" method="get">
        <div className="field">
          <label className="field-label" htmlFor="q">Buscar</label>
          <input className="input" id="q" name="q" defaultValue={query.q} placeholder="Título, autor o descripción" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tema">Tema</label>
          <select className="select" id="tema" name="tema" defaultValue={query.tema ?? ""}>
            <option value="">Todos</option>
            {tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </div>
        <button className="btn btn-secondary" type="submit">Filtrar</button>
      </form>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Título</th><th>Autor/a</th><th>Temas</th><th></th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td><Link href={`/admin/formacion/${item.id}`}>{item.title}</Link>{item.year && <span className="muted"> ({item.year})</span>}</td>
                <td>{item.author || "—"}</td>
                <td><div className="pill-row">{item.tags.map((tag) => <TagPill key={tag.id} name={tag.name} color={tag.color} archived={tag.archived} />)}</div></td>
                <td>
                  {item.storagePath
                    ? <a className="btn btn-ghost btn-sm" href={`/admin/descargas/formacion/${item.id}`}>Descargar</a>
                    : item.externalUrl && <a className="btn btn-ghost btn-sm" href={item.externalUrl} target="_blank" rel="noopener noreferrer">Abrir ↗</a>}
                </td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="muted">No hay material con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager basePath="/admin/formacion" params={filters} page={page} total={total} />
    </section>
  );
}
