import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { signInAdmin } from "@/app/admin/login/actions";
import { getStaffAccess } from "@/lib/auth/staff";

export const metadata: Metadata = {
  title: "Acceso de administración, MEJOR QUE DECIR",
  robots: { index: false, follow: false },
};

const errorMessages: Record<string, string> = {
  invalid: "No pudimos validar el acceso. Revisá el correo y la contraseña.",
  configuration: "El acceso todavía no está conectado a Supabase.",
  unauthorized: "Esta cuenta no tiene permiso para administrar el sitio.",
  link: "El enlace venció o ya se usó. Pedile a un admin una nueva invitación.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await getStaffAccess();

  if (access.status === "staff") {
    redirect("/admin");
  }

  const { error } = await searchParams;
  const message = error ? errorMessages[error] : undefined;
  const supabaseReady = access.status !== "not-configured";

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Panel de administración</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Ingresar</h1>
          <p>Acceso privado para administrar la plataforma.</p>
        </section>

        <section className="section-tight wrap">
          {message && <p className="form-msg is-visible error" role="alert">{message}</p>}

          {!supabaseReady ? (
            <div className="card">
              <h2 className="mt-0" style={{ fontSize: 19 }}>Configuración pendiente</h2>
              <p className="muted">
                Para habilitar el acceso, conectá las variables de Supabase indicadas en
                <code> .env.example</code> y aplicá la migración de administración.
              </p>
            </div>
          ) : access.status === "unavailable" ? (
            <div className="card" role="alert">
              <h2 className="mt-0" style={{ fontSize: 19 }}>Acceso no disponible</h2>
              <p className="muted mb-0">
                No se pudo verificar la autorización. Revisá que la migración de administración
                esté aplicada.
              </p>
            </div>
          ) : (
            <div className="card">
              <form action={signInAdmin}>
                <div className="field">
                  <label className="field-label" htmlFor="email">Correo electrónico</label>
                  <input
                    className="input"
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    maxLength={254}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="password">Contraseña</label>
                  <input
                    className="input"
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    maxLength={256}
                    required
                  />
                </div>
                <div className="survey-submit">
                  <button className="btn btn-primary btn-block" type="submit">Ingresar</button>
                </div>
              </form>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
