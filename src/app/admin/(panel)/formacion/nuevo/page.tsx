import Link from "next/link";
import { FlashMessages } from "@/components/admin/ListUi";
import { LibraryForm } from "@/features/library/LibraryForm";
import { requireStaff } from "@/lib/auth/require-staff";
import { listTags } from "@/lib/data/tags";

export default async function NewLibraryItemPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requireStaff("editor"), searchParams]);
  const tags = await listTags(supabase, ["tema_formacion"]);

  return (
    <section className="wrap">
      <p style={{ marginTop: 20 }}><Link href="/admin/formacion">← Formación</Link></p>
      <div className="admin-head"><h1>Agregar material</h1></div>
      <FlashMessages error={query.error} errors={{
        invalid: "Revisá el título y el año.",
        source: "Subí un archivo o pegá un link (uno solo).",
        save: "No pudimos guardar.",
      }} />
      <LibraryForm tags={tags} />
    </section>
  );
}
