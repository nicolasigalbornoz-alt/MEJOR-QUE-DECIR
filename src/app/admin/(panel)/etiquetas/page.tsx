import { createTag, deleteTag, updateTag } from "@/app/admin/(panel)/etiquetas/actions";
import { DEFAULT_TAG_COLORS, TAG_CATEGORIES, TAG_CATEGORY_KEYS } from "@/features/tags/categories";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { listTags, tagsByCategory } from "@/lib/data/tags";

const errorMessages: Record<string, string> = {
  invalid: "Revisá el nombre y el color.",
  duplicate: "Ya existe una etiqueta con ese nombre en esa categoría.",
  "in-use": "La etiqueta está en uso. Archivala para que deje de ofrecerse.",
  save: "No pudimos guardar el cambio.",
};

export default async function TagsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const [{ supabase, access }, query] = await Promise.all([requireStaff(), searchParams]);
  const tags = await listTags(supabase, undefined, { includeArchived: true });
  const canEdit = hasRole(access.role, "editor");
  const canDelete = access.role === "admin";

  return (
    <section className="wrap">
      <div className="admin-head"><h1>Etiquetas</h1></div>
      <p className="muted mt-0">Las etiquetas archivadas siguen en los registros que ya las usan, pero no se ofrecen para cargar nuevos.</p>
      {query.error && <p className="form-msg is-visible error" role="alert">{errorMessages[query.error] ?? errorMessages.save}</p>}
      {query.saved && <p className="form-msg is-visible success" role="status">Cambios guardados.</p>}

      {TAG_CATEGORY_KEYS.map((category) => {
        const items = tagsByCategory(tags, category);
        return (
          <div className="card" key={category} id={category}>
            <h2 className="mt-0" style={{ fontSize: 18 }}>{TAG_CATEGORIES[category].label}</h2>
            <p className="muted mt-0">{TAG_CATEGORIES[category].help}</p>

            {!items.length && <p className="muted">Todavía no hay etiquetas.</p>}
            {canEdit ? items.map((tag) => (
              <div key={tag.id} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 8 }}>
                <form action={updateTag} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", flex: 1 }}>
                  <input type="hidden" name="id" value={tag.id} />
                  <input type="color" name="color" defaultValue={tag.color} aria-label={`Color de ${tag.name}`} />
                  <input className="input" name="name" defaultValue={tag.name} maxLength={80} required aria-label="Nombre" style={{ flex: "1 1 180px" }} />
                  <label className="small"><input type="checkbox" name="archived" value="true" defaultChecked={tag.archived} /> Archivada</label>
                  <button className="btn btn-ghost btn-sm" type="submit">Guardar</button>
                </form>
                {canDelete && (
                  <form action={deleteTag}>
                    <input type="hidden" name="id" value={tag.id} />
                    <button className="btn btn-danger btn-sm" type="submit">Borrar</button>
                  </form>
                )}
              </div>
            )) : (
              <div className="pill-row">
                {items.map((tag) => (
                  <span key={tag.id} className={`label-pill${tag.archived ? " is-archived" : ""}`} style={{ ["--pill-color" as string]: tag.color }}>{tag.name}</span>
                ))}
              </div>
            )}

            {canEdit && (
              <form action={createTag} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 14 }}>
                <input type="hidden" name="category" value={category} />
                <input type="color" name="color" defaultValue={DEFAULT_TAG_COLORS[items.length % DEFAULT_TAG_COLORS.length]} aria-label="Color" />
                <input className="input" name="name" placeholder="Nueva etiqueta" maxLength={80} required style={{ flex: "1 1 180px" }} />
                <button className="btn btn-secondary btn-sm" type="submit">Agregar</button>
              </form>
            )}
          </div>
        );
      })}
    </section>
  );
}
