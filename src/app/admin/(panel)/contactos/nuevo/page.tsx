import Link from "next/link";
import { FlashMessages } from "@/components/admin/ListUi";
import { ContactForm } from "@/features/contacts/ContactForm";
import { requireStaff } from "@/lib/auth/require-staff";
import { listTags } from "@/lib/data/tags";

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ supabase }, query] = await Promise.all([requireStaff("editor"), searchParams]);
  const typeTags = await listTags(supabase, ["tipo_contacto"]);

  return (
    <section className="wrap">
      <p style={{ marginTop: 20 }}><Link href="/admin/contactos">← Contactos</Link></p>
      <div className="admin-head"><h1>Nuevo contacto</h1></div>
      <FlashMessages error={query.error} errors={{ invalid: "Revisá nombre, mail y referentes.", save: "No pudimos guardar." }} />
      <ContactForm typeTags={typeTags} />
    </section>
  );
}
