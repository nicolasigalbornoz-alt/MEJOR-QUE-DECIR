import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { signOutAdmin } from "@/app/admin/actions";
import { getAdminAccess } from "@/lib/auth/admin";

export const metadata: Metadata = {
  title: "Administración, MEJOR QUE DECIR",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await getAdminAccess();

  if (access.status === "not-configured") {
    redirect("/admin/login?error=configuration");
  }

  if (access.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (access.status === "unauthorized") {
    redirect("/admin/login?error=unauthorized");
  }

  if (access.status === "unavailable") {
    redirect("/admin/login?error=configuration");
  }

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Panel de administración</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Administración</h1>
          <p>Sesión iniciada como {access.email ?? "administrador"}.</p>
        </section>

        <section className="section-tight wrap">
          <div className="card">
            <h2 className="mt-0" style={{ fontSize: 19 }}>Gestionar plataforma</h2>
            <p className="muted">Sesión de administración verificada en servidor y en Supabase.</p>
            <div className="hero-actions">
              <Link className="btn btn-secondary" href="/admin/events">Eventos</Link>
              <Link className="btn btn-secondary" href="/admin/forms">Formularios</Link>
              <Link className="btn btn-secondary" href="/admin/respuestas">Respuestas</Link>
              <Link className="btn btn-secondary" href="/admin/actas">Actas</Link>
              <Link className="btn btn-secondary" href="/admin/cupos">Cupos</Link>
            </div>
            <form action={signOutAdmin} style={{ marginTop: 18 }}>
              <button className="btn btn-ghost" type="submit">Cerrar sesión</button>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
