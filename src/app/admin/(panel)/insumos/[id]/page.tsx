import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteActivity } from "@/app/admin/(panel)/insumos/actions";
import { FlashMessages, TagPill } from "@/components/admin/ListUi";
import { ActivityForm } from "@/features/activities/ActivityForm";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { getActivity } from "@/lib/data/activities";
import { listTags } from "@/lib/data/tags";

const errors = {
  invalid: "Revisá el nombre y los textos.",
  attachments: "Algún adjunto no es válido. Volvé a subirlo.",
  links: "Se guardaron los textos, pero no los tags o las personas. Probá de nuevo.",
  save: "No pudimos guardar.",
};

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; editar?: string }>;
}) {
  const [{ supabase, access }, { id }, query] = await Promise.all([requireStaff(), params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [activity, tags] = await Promise.all([
    getActivity(supabase, id),
    listTags(supabase, ["publico", "actividad"], { includeArchived: true }),
  ]);
  if (!activity) notFound();
  const editing = hasRole(access.role, "editor") && query.editar === "1";

  return (
    <section className="wrap">
      <p style={{ marginTop: 20 }}><Link href="/admin/insumos">← Insumos</Link></p>
      <div className="admin-head">
        <h1>{activity.title}</h1>
        <span style={{ display: "flex", gap: 8 }}>
          {hasRole(access.role, "editor") && (
            <Link className="btn btn-ghost btn-sm" href={editing ? `/admin/insumos/${activity.id}` : `/admin/insumos/${activity.id}?editar=1`}>
              {editing ? "Ver ficha" : "Editar"}
            </Link>
          )}
          {access.role === "admin" && (
            <form action={deleteActivity}>
              <input type="hidden" name="id" value={activity.id} />
              <button className="btn btn-danger btn-sm" type="submit">Borrar</button>
            </form>
          )}
        </span>
      </div>
      <FlashMessages error={query.error} saved={query.saved} errors={errors} />

      {editing ? <ActivityForm activity={activity} tags={tags} /> : (
        <>
          <div className="card">
            <div className="pill-row" style={{ marginBottom: 12 }}>
              {activity.tags.map((tag) => <TagPill key={tag.id} name={tag.name} color={tag.color} archived={tag.archived} />)}
            </div>
            {activity.description && <><h2 className="mt-0" style={{ fontSize: 16 }}>Descripción</h2><p style={{ whiteSpace: "pre-wrap" }}>{activity.description}</p></>}
            {activity.purpose && <><h2 style={{ fontSize: 16 }}>Utilidad o finalidad</h2><p style={{ whiteSpace: "pre-wrap" }}>{activity.purpose}</p></>}
            {activity.procedure && <><h2 style={{ fontSize: 16 }}>Procedimiento</h2><p style={{ whiteSpace: "pre-wrap" }}>{activity.procedure}</p></>}
          </div>
          <div className="card">
            <h2 className="mt-0" style={{ fontSize: 16 }}>Documentos y links</h2>
            <ul className="mb-0">
              {activity.attachments.map((item) => (
                <li key={item.id}>
                  {item.kind === "file"
                    ? <a href={`/admin/descargas/insumo/${item.id}`}>{item.title}</a>
                    : <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a>}
                </li>
              ))}
              {!activity.attachments.length && <li className="muted">Sin adjuntos.</li>}
            </ul>
          </div>
          <div className="card">
            <h2 className="mt-0" style={{ fontSize: 16 }}>Quiénes la hicieron</h2>
            <ul className="mb-0">
              {activity.people.map((person) => (
                <li key={person.id}>
                  <Link href={person.kind === "militant" ? `/admin/companeros/${person.refId}` : `/admin/contactos/${person.refId}`}>{person.name}</Link>
                  {person.note && <span className="muted"> · {person.note}</span>}
                </li>
              ))}
              {!activity.people.length && <li className="muted">Sin datos.</li>}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
