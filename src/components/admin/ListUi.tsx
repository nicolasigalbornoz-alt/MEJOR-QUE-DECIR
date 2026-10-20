import Link from "next/link";
import { PAGE_SIZE } from "@/lib/data/listing";

export function TagPill({ name, color, archived = false, detail }: { name: string; color: string; archived?: boolean; detail?: string }) {
  return (
    <span className={`label-pill${archived ? " is-archived" : ""}`} style={{ ["--pill-color" as string]: color }}>
      {name}{detail ? `: ${detail}` : ""}
    </span>
  );
}

export function Pager({ basePath, params, page, total }: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  return (
    <nav className="pager" aria-label="Paginación">
      <span className="muted">{total.toLocaleString("es-AR")} resultados · página {page} de {pages}</span>
      <span style={{ display: "flex", gap: 8 }}>
        {page > 1 && <Link className="btn btn-ghost btn-sm" href={href(page - 1)}>Anterior</Link>}
        {page < pages && <Link className="btn btn-ghost btn-sm" href={href(page + 1)}>Siguiente</Link>}
      </span>
    </nav>
  );
}

export function FlashMessages({ error, saved, errors }: {
  error?: string;
  saved?: string;
  errors: Record<string, string>;
}) {
  return (
    <>
      {error && <p className="form-msg is-visible error" role="alert">{errors[error] ?? errors.save ?? "No pudimos guardar el cambio."}</p>}
      {saved && <p className="form-msg is-visible success" role="status">Cambios guardados.</p>}
    </>
  );
}
