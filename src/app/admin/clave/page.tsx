import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { setStaffPassword } from "@/app/admin/clave/actions";
import { requireStaff } from "@/lib/auth/require-staff";

export const metadata: Metadata = {
  title: "Elegir contraseña, MEJOR QUE DECIR",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid: "La contraseña debe tener al menos 10 caracteres y coincidir en ambos campos.",
  save: "No pudimos guardar la contraseña. Probá de nuevo.",
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ access }, { error }] = await Promise.all([requireStaff(), searchParams]);
  const message = error ? errorMessages[error] : undefined;

  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero wrap" style={{ paddingTop: 28 }}>
          <span className="eyebrow">Panel de administración</span>
          <h1 style={{ fontSize: "clamp(24px, 7vw, 30px)" }}>Elegí tu contraseña</h1>
          <p>Cuenta: {access.email}</p>
        </section>
        <section className="section-tight wrap">
          {message && <p className="form-msg is-visible error" role="alert">{message}</p>}
          <div className="card">
            <form action={setStaffPassword}>
              <div className="field">
                <label className="field-label" htmlFor="password">Nueva contraseña</label>
                <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} maxLength={256} required />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="confirm">Repetila</label>
                <input className="input" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} maxLength={256} required />
              </div>
              <div className="survey-submit">
                <button className="btn btn-primary btn-block" type="submit">Guardar y entrar</button>
              </div>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
