import Link from "next/link";
import { FlashMessages, Pager, TagPill } from "@/components/admin/ListUi";
import { PROVINCES } from "@/data/provinces";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { parsePage } from "@/lib/data/listing";
import { listMilitants, type MilitantFilters } from "@/lib/data/militants";
import { listTags } from "@/lib/data/tags";

const provinceName = new Map(PROVINCES.map((province) => [province.id, province.name]));

export default async function MilitantsPage({
  searchParams,
}: {
  searchParams: Promise<MilitantFilters & { page?: string; error?: string; saved?: string }>;
}) {
  const [{ supabase, access }, query] = await Promise.all([requireStaff(), searchParams]);
  const page = parsePage(query.page);
  const filters: MilitantFilters = { q: query.q, provincia: query.provincia, responsabilidad: query.responsabilidad, inactivos: query.inactivos };
  const [{ items, total }, roleTags] = await Promise.all([
    listMilitants(supabase, filters, page),
    listTags(supabase, ["responsabilidad"], { includeArchived: true }),
  ]);

  return (
    <section className="wrap">
      <div className="admin-head">
        <h1>Compañeros</h1>
        {hasRole(access.role, "editor") && <Link className="btn btn-primary" href="/admin/companeros/nuevo">Nuevo compañero</Link>}
      </div>
      <FlashMessages error={query.error} saved={query.saved} errors={{ invalid: "Datos inválidos." }} />

      <form className="admin-toolbar" method="get">
        <div className="field">
          <label className="field-label" htmlFor="q">Buscar</label>
          <input className="input" id="q" name="q" defaultValue={query.q} placeholder="Nombre, localidad o mail" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="provincia">Provincia</label>
          <select className="select" id="provincia" name="provincia" defaultValue={query.provincia ?? ""}>
            <option value="">Todas</option>
            {PROVINCES.map((province) => <option key={province.id} value={province.id}>{province.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="responsabilidad">Responsabilidad</label>
          <select className="select" id="responsabilidad" name="responsabilidad" defaultValue={query.responsabilidad ?? ""}>
            <option value="">Todas</option>
            {roleTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </div>
        <label className="small"><input type="checkbox" name="inactivos" value="1" defaultChecked={query.inactivos === "1"} /> Incluir inactivos</label>
        <button className="btn btn-secondary" type="submit">Filtrar</button>
      </form>

      <div className="data-table-wrap">
        <table className="data-table">
          <thead><tr><th>Nombre</th><th>Lugar</th><th>Responsabilidades</th><th>Contacto</th></tr></thead>
          <tbody>
            {items.map((militant) => (
              <tr key={militant.id}>
                <td><Link href={`/admin/companeros/${militant.id}`}>{militant.fullName}</Link>{!militant.active && <span className="muted"> (inactivo)</span>}</td>
                <td>{[militant.locality, militant.provinceId ? provinceName.get(militant.provinceId) : ""].filter(Boolean).join(", ") || "—"}</td>
                <td><div className="pill-row">{militant.roles.map((role) => <TagPill key={role.id} name={role.tag.name} color={role.tag.color} detail={role.detail} />)}</div></td>
                <td className="small">{[militant.phone, militant.email].filter(Boolean).join(" · ") || "—"}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="muted">No hay compañeros con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager basePath="/admin/companeros" params={filters} page={page} total={total} />
    </section>
  );
}
