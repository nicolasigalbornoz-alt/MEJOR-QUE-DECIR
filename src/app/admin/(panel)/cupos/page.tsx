import type { Metadata } from "next";
import { COMMISSIONS, WORKSHOPS } from "@/features/forms/catalogs";
import { updateCapacity } from "@/app/admin/(panel)/cupos/actions";
import { requireStaff } from "@/lib/auth/require-staff";

export const metadata: Metadata = { title: "Administrar cupos, MEJOR QUE DECIR", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminCapacityPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { supabase } = await requireStaff();
  const [{ data: form }, { data: dbCommissions }, { data: dbWorkshops }, query] = await Promise.all([
    supabase.from("forms").select("id,form_versions(id,status)").eq("slug", "mejor-que-decir").maybeSingle(),
    supabase.from("commissions").select("id,name,capacity").eq("active", true).order("position"),
    supabase.from("workshops").select("id,name,capacity").eq("active", true).order("position"),
    searchParams,
  ]);
  const version = form?.form_versions?.find((item) => item.status === "published");

  async function counted(type: "commission" | "workshop", id: string) {
    if (!version) return 0;
    const field = type === "commission" ? "comision" : "taller";
    const { count } = await supabase.from("form_submissions").select("id", { count: "exact", head: true })
      .eq("form_version_id", version.id).eq("is_demo", false).contains("answers", { [field]: id });
    return count ?? 0;
  }

  const lists = [
    { type: "commission" as const, heading: "Comisiones", options: dbCommissions?.length ? dbCommissions : COMMISSIONS },
    { type: "workshop" as const, heading: "Talleres", options: dbWorkshops?.length ? dbWorkshops : WORKSHOPS },
  ];
  const renderedLists = await Promise.all(lists.map(async (list) => ({
    ...list,
    options: await Promise.all(list.options.map(async (option) => ({
      ...option,
      count: await counted(list.type, option.id),
    }))),
  })));

  return (
    <>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Administración</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Cupos</h1>
          <p>Disponibilidad calculada únicamente con respuestas reales; los datos de demostración se excluyen.</p>
        </section>
        <section className="section-tight wrap">
          {query.error && <p className="form-msg is-visible error" role="alert">No se pudo guardar el cupo.</p>}
          {query.saved && <p className="form-msg is-visible success" role="status">Cupo actualizado.</p>}
          {!version && <p className="muted">La base todavía no tiene la versión publicada de la encuesta; los conteos aparecen en cero hasta aplicar las migraciones.</p>}
          {renderedLists.map((list) => (
            <section key={list.type}>
              <h2>{list.heading}</h2>
              {list.options.map((option) => (
                  <article className="card" key={option.id}>
                    <h3 className="mt-0">{option.name}</h3>
                    <p>{option.count} confirmados · cupo {option.capacity} · {Math.max(option.capacity - option.count, 0)} disponibles</p>
                    <form action={updateCapacity} style={{ display: "flex", alignItems: "end", gap: 8 }}>
                      <input type="hidden" name="type" value={list.type} />
                      <input type="hidden" name="id" value={option.id} />
                      <div className="field"><label className="field-label" htmlFor={`capacity-${option.id}`}>Nuevo cupo</label><input className="input" id={`capacity-${option.id}`} name="capacity" type="number" min={0} max={100000} defaultValue={option.capacity} required /></div>
                      <button className="btn btn-ghost" type="submit">Actualizar</button>
                    </form>
                  </article>
              ))}
            </section>
          ))}
        </section>
    </>
  );
}
