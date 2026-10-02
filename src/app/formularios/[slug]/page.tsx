import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { FormRenderer } from "@/features/forms/FormRenderer";
import { getPublishedForm } from "@/lib/data/forms";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const form = await getPublishedForm(slug);
  return { title: form ? `${form.title}, MEJOR QUE DECIR` : "Formulario, MEJOR QUE DECIR" };
}

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const form = await getPublishedForm(slug);
  if (!form) notFound();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">3 minutos · desde tu celular</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>{form.title}</h1>
          <p>{form.intro}</p>
        </section>
        <section className="section-tight wrap">
          <FormRenderer form={form} />
        </section>
        <section className="section-tight wrap">
          <p className="muted small">
            Usamos tu nombre solo para reconocerte del padrón y autocompletar tu provincia y localidad.
            No se publica en los resultados, que se muestran de forma agregada.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
