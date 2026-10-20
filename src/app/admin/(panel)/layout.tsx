import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { AdminNav } from "@/components/admin/AdminNav";
import { signOutAdmin } from "@/app/admin/actions";
import { requireStaff } from "@/lib/auth/require-staff";
import { STAFF_ROLE_LABELS } from "@/lib/auth/staff";

export const metadata: Metadata = {
  title: "Administración, MEJOR QUE DECIR",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const { access } = await requireStaff();

  return (
    <>
      <SiteHeader />
      <div className="admin-shell">
        <AdminNav
          role={access.role}
          userLabel={access.displayName || access.email || "Cuenta"}
          roleLabel={STAFF_ROLE_LABELS[access.role]}
          signOut={signOutAdmin}
        />
        <main className="admin-main">{children}</main>
      </div>
      <SiteFooter />
    </>
  );
}
