import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteLibraryItem } from "@/app/admin/(panel)/formacion/actions";
import { FlashMessages, TagPill } from "@/components/admin/ListUi";
import { LibraryForm } from "@/features/library/LibraryForm";
import { requireStaff } from "@/lib/auth/require-staff";
import { hasRole } from "@/lib/auth/staff";
import { getLibraryItem } from "@/lib/data/library";
import { listTags } from "@/lib/data/tags";

const errors = {
  invalid: "Revisá el título y el año.",
  source: "Subí un archivo o pegá un link (uno solo).",
  tags: "Se guardó el material, pero no los temas. Probá de nuevo.",
  save: "No pudimos guardar.",
};

export default async function LibraryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string; editar?: string }>;
}) {
  const [{ supabase, access }, { id }, query] = await Promise.all([requireStaff(), params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [item, tags] = await Promise.all([
    getLibraryItem(supabase, id),
    listTags(supabase, ["tema_formacion"], { includeArchived: true }),
  ]);
  if (!item) notFound();
  const canEdit = hasRole(access.role, "editor");
  const editing = canEdit && query.editar === "1";

  return (
    <section className="wrap">
      <p style={{ marginTop: 20 }}><Link href="/admin/formacion">← Formación</Link></p>
      <div className="admin-head">
        <h1>{item.title}</h1>
        <span style={{ display: "flex", gap: 8 }}>
          {canEdit && (
            <Link className="btn btn-ghost btn-sm" href={editing ? `/admin/formacion/${item.id}` : `/admin/formacion/${item.id}?editar=1`}>
              {editing ? "Ver ficha" : "Editar"}
            </Link>
          )}
          {access.role === "admin" && (
            <form action={deleteLibraryItem}>
              <input type="hidden" name="id" value={item.id} />
              <button className="btn btn-danger btn-sm" type="submit">Borrar</button>
            </form>
          )}
        </span>
      </div>
      <FlashMessages error={query.error} saved={query.saved} errors={errors} />

      {editing ? <LibraryForm item={item} tags={tags} /> : (
        <div className="card">
          <p className="mt-0">{[item.author, item.year].filter(Boolean).join(" · ") || "Sin autor/a cargado"}</p>
          <div className="pill-row" style={{ marginBottom: 12 }}>
            {item.tags.map((tag) => <TagPill key={tag.id} name={tag.name} color={tag.color} archived={tag.archived} />)}
          </div>
          {item.description && <p style={{ whiteSpace: "pre-wrap" }}>{item.description}</p>}
          {item.storagePath
            ? <a className="btn btn-primary" href={`/admin/descargas/formacion/${item.id}`}>Descargar ({((item.sizeBytes ?? 0) / 1024 / 1024).toFixed(1)} MB)</a>
            : item.externalUrl && <a className="btn btn-primary" href={item.externalUrl} target="_blank" rel="noopener noreferrer">Abrir link ↗</a>}
        </div>
      )}
    </section>
  );
}
