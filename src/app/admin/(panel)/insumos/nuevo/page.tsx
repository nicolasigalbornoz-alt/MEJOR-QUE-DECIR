import Link from "next/link";
import { FlashMessages } from "@/components/admin/ListUi";
import { ActivityForm } from "@/features/activities/ActivityForm";
import { requireStaff } from "@/lib/auth/require-staff";
import { listTags } from "@/lib/data/tags";

export default async function NewActivityPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requireStaff("editor"), searchParams]);
  const tags = await listTags(supabase, ["publico", "actividad"]);

  return (
    <section className="wrap">
      <p style={{ marginTop: 20 }}><Link href="/admin/insumos">← Insumos</Link></p>
      <div className="admin-head"><h1>Nueva actividad</h1></div>
      <FlashMessages error={query.error} errors={{
        invalid: "Revisá el nombre y los textos.",
        attachments: "Algún adjunto no es válido. Volvé a subirlo.",
        save: "No pudimos guardar.",
      }} />
      <ActivityForm tags={tags} />
    </section>
  );
}
