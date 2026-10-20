import Link from "next/link";
import { FlashMessages } from "@/components/admin/ListUi";
import { MilitantForm } from "@/features/militants/MilitantForm";
import { requireStaff } from "@/lib/auth/require-staff";
import { listTags } from "@/lib/data/tags";

export default async function NewMilitantPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requireStaff("editor"), searchParams]);
  const roleTags = await listTags(supabase, ["responsabilidad"]);

  return (
    <section className="wrap">
      <p className="mt-0" style={{ marginTop: 20 }}><Link href="/admin/companeros">← Compañeros</Link></p>
      <div className="admin-head"><h1>Nuevo compañero</h1></div>
      <FlashMessages error={query.error} errors={{ invalid: "Revisá nombre, mail y responsabilidades.", save: "No pudimos guardar." }} />
      <MilitantForm roleTags={roleTags} />
    </section>
  );
}
