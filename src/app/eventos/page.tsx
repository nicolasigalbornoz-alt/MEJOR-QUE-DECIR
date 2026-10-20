import Link from "next/link";
import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { listPublishedEvents } from "@/lib/data/events";
import { formatArgentinaDate } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Eventos, MEJOR QUE DECIR",
  description: "Información de los eventos de Jóvenes FR.",
};

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const events = await listPublishedEvents();
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Agenda federal</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Eventos</h1>
          <p>Información y formularios de los encuentros de Jóvenes FR.</p>
        </section>
        <section className="section-tight wrap">
          {events.length ? events.map((event) => (
            <article className="card" key={event.id}>
              <h2 className="mt-0" style={{ fontSize: 19 }}>{event.title}</h2>
              {event.starts_at && <p className="eyebrow">{formatArgentinaDate(event.starts_at)}</p>}
              <p>{event.description}</p>
              <Link className="btn btn-secondary" href={`/eventos/${event.slug}`}>Ver evento</Link>
            </article>
          )) : <p className="empty-note">Todavía no hay eventos publicados.</p>}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
