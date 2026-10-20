import Link from "next/link";
import { requireStaff } from "@/lib/auth/require-staff";
import { STAFF_ROLE_LABELS } from "@/lib/auth/staff";

const sections = [
  { table: "militants", label: "Compañeros", href: "/admin/companeros" },
  { table: "contacts", label: "Contactos", href: "/admin/contactos" },
  { table: "activities", label: "Insumos", href: "/admin/insumos" },
  { table: "library_items", label: "Formación", href: "/admin/formacion" },
  { table: "form_submissions", label: "Respuestas 2026", href: "/admin/respuestas" },
] as const;

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ supabase, access }, query] = await Promise.all([requireStaff(), searchParams]);
  const counts = await Promise.all(sections.map(async (section) => {
    const { count, error } = await supabase.from(section.table).select("*", { count: "exact", head: true });
    return error ? null : count ?? 0;
  }));

  return (
    <section className="wrap">
      <div className="admin-head">
        <div>
          <span className="eyebrow">Panel de administración</span>
          <h1>Hola{access.displayName ? `, ${access.displayName}` : ""}</h1>
          <p className="muted mt-0">{access.email} · {STAFF_ROLE_LABELS[access.role]}</p>
        </div>
      </div>
      {query.error === "forbidden" && (
        <p className="form-msg is-visible error" role="alert">Tu rol no tiene permiso para esa acción.</p>
      )}
      <div className="stat-grid">
        {sections.map((section, index) => (
          <Link className="card" key={section.table} href={section.href}>
            <b>{counts[index] === null ? "—" : counts[index]!.toLocaleString("es-AR")}</b>
            <span>{section.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
