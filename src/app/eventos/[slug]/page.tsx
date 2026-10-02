import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getPublishedEvent } from "@/lib/data/events";
import { listPublishedFormsForEvent } from "@/lib/data/forms";
import { formatArgentinaDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublishedEvent(slug);
  return { title: event ? `${event.title}, MEJOR QUE DECIR` : "Evento, MEJOR QUE DECIR" };
}

export default async function EventDetailsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getPublishedEvent(slug);
  if (!event) notFound();
  const forms = await listPublishedFormsForEvent(event.id);

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Evento</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>{event.title}</h1>
          {event.starts_at && <p className="muted">{formatArgentinaDate(event.starts_at)}</p>}
          <p>{event.description}</p>
        </section>
        <section className="section-tight wrap">
          <h2>Formularios del evento</h2>
          {forms.map((form) => (
            <article className="card" key={form.id}>
              <h3 className="mt-0">{form.title}</h3>
              <p>{form.intro}</p>
              <Link className="btn btn-primary" href={`/formularios/${form.slug}`}>Abrir formulario</Link>
            </article>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
