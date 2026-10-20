import Link from "next/link";
import { FlashMessages, Pager, TagPill } from "@/components/admin/ListUi";
import { TAG_CATEGORIES } from "@/features/tags/categories";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { listActivities, type ActivityFilters } from "@/lib/data/activities";
import { parsePage } from "@/lib/data/listing";
import { listTags } from "@/lib/data/tags";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<ActivityFilters & { page?: string; error?: string; saved?: string }>;
}) {
  const [{ supabase, access }, query] = await Promise.all([requireStaff(), searchParams]);
  const page = parsePage(query.page);
  const filters: ActivityFilters = { q: query.q, tag: query.tag };
  const [{ items, total }, tags] = await Promise.all([
    listActivities(supabase, filters, page),
    listTags(supabase, ["publico", "actividad"], { includeArchived: true }),
  ]);

  return (
    <section className="wrap">
      <div className="admin-head">
        <h1>Insumos</h1>
        {hasRole(access.role, "editor") && <Link className="btn btn-primary" href="/admin/insumos/nuevo">Nueva actividad</Link>}
      </div>
      <p className="muted mt-0">Actividades para replicar en cada distrito, con su procedimiento y quiénes las hicieron.</p>
      <FlashMessages error={query.error} saved={query.saved} errors={{ invalid: "Datos inválidos." }} />

      <form className="admin-toolbar" method="get">
        <div className="field">
          <label className="field-label" htmlFor="q">Buscar</label>
          <input className="input" id="q" name="q" defaultValue={query.q} placeholder="Nombre, descripción o finalidad" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="tag">Orientado a / tag</label>
          <select className="select" id="tag" name="tag" defaultValue={query.tag ?? ""}>
            <option value="">Todos</option>
            {(["publico", "actividad"] as const).map((category) => (
              <optgroup key={category} label={TAG_CATEGORIES[category].label}>
                {tags.filter((tag) => tag.category === category).map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary" type="submit">Filtrar</button>
      </form>

      {items.map((activity) => (
        <article className="card" key={activity.id}>
          <h2 className="mt-0" style={{ fontSize: 18 }}><Link href={`/admin/insumos/${activity.id}`}>{activity.title}</Link></h2>
          <div className="pill-row" style={{ marginBottom: 8 }}>
            {activity.tags.map((tag) => <TagPill key={tag.id} name={tag.name} color={tag.color} archived={tag.archived} />)}
          </div>
          {activity.description && <p className="mb-0">{activity.description.length > 220 ? `${activity.description.slice(0, 220)}…` : activity.description}</p>}
          <p className="muted mb-0">{activity.attachmentCount} adjunto{activity.attachmentCount === 1 ? "" : "s"}</p>
        </article>
      ))}
      {!items.length && <p className="muted">No hay actividades con esos filtros.</p>}
      <Pager basePath="/admin/insumos" params={filters} page={page} total={total} />
    </section>
  );
}
