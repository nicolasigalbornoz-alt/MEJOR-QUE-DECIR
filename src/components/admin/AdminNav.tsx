"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Role = "admin" | "editor" | "viewer";

type NavItem = { href: string; label: string; adminOnly?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  { label: "", items: [{ href: "/admin", label: "Inicio" }] },
  {
    label: "Base de datos",
    items: [
      { href: "/admin/companeros", label: "Compañeros" },
      { href: "/admin/contactos", label: "Contactos" },
    ],
  },
  {
    label: "Recursos",
    items: [
      { href: "/admin/insumos", label: "Insumos" },
      { href: "/admin/formacion", label: "Formación" },
    ],
  },
  {
    label: "Encuentro 2026",
    items: [
      { href: "/admin/events", label: "Eventos" },
      { href: "/admin/forms", label: "Formularios" },
      { href: "/admin/respuestas", label: "Respuestas" },
      { href: "/admin/actas", label: "Actas" },
      { href: "/admin/cupos", label: "Cupos" },
    ],
  },
  {
    label: "Configuración",
    items: [
      { href: "/admin/etiquetas", label: "Etiquetas" },
      { href: "/admin/usuarios", label: "Usuarios", adminOnly: true },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNav({ role, userLabel, roleLabel, signOut }: {
  role: Role;
  userLabel: string;
  roleLabel: string;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((group) => group.items).find((item) => isActive(pathname, item.href));

  return (
    <aside className={`admin-nav${open ? " is-open" : ""}`}>
      <button
        className="admin-nav__toggle"
        type="button"
        aria-expanded={open}
        aria-controls="adminNavLinks"
        onClick={() => setOpen(!open)}
      >
        <span>{current?.label ?? "Panel"}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      <nav id="adminNavLinks" className="admin-nav__links" aria-label="Panel de administración">
        {groups.map((group) => {
          const items = group.items.filter((item) => !item.adminOnly || role === "admin");
          if (!items.length) return null;
          return (
            <div className="admin-nav__group" key={group.label || "inicio"}>
              {group.label && <p className="admin-nav__label">{group.label}</p>}
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={isActive(pathname, item.href) ? "is-active" : undefined}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          );
        })}
        <div className="admin-nav__user">
          <p className="mb-0"><b>{userLabel}</b></p>
          <p className="muted mt-0">{roleLabel}</p>
          <form action={signOut}>
            <button className="btn btn-ghost btn-sm" type="submit">Cerrar sesión</button>
          </form>
        </div>
      </nav>
    </aside>
  );
}
