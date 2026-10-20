"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Inicio", active: true },
  { href: "/eventos", label: "Eventos", active: false },
  { href: "/encuesta", label: "Encuesta", active: false },
  { href: "/mapa", label: "Mapa federal", active: false },
  { href: "/sintesis", label: "Síntesis", active: false },
  { href: "/insumos", label: "Insumos", active: false },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem("mqd_theme");
      const dark = savedTheme
        ? savedTheme === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches;
      // Sincroniza una preferencia externa (localStorage) al hidratar el botón.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDark(dark);
    } catch {
      setIsDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
  }, []);

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    try {
      window.localStorage.setItem("mqd_theme", nextTheme);
    } catch {
      // El cambio de tema sigue vigente para esta página aunque no se guarde.
    }
    setIsDark(!isDark);
  }

  return (
    <header className="site-header">
      <div className="site-header__bar">
        <Link className="brand" href="/" aria-label="MEJOR QUE DECIR, Inicio">
          <Image className="brand__logo" src="/assets/img/jovenesfr-logo.png" alt="Jóvenes FR" width={132} height={27} priority />
          <span className="brand__title">MEJOR&nbsp;QUE&nbsp;DECIR</span>
        </Link>

        <nav className={`site-nav${isMenuOpen ? " is-open" : ""}`} id="siteNav" aria-label="Navegación principal">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={(link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)) ? "is-active" : undefined}
              onClick={() => setIsMenuOpen(false)}
            >
              <span className="dot" />
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          className={`theme-toggle${isDark ? " is-dark" : ""}`}
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          <svg className="theme-toggle__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
          <svg className="theme-toggle__moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        </button>

        <button
          className="nav-toggle"
          type="button"
          aria-label={isMenuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isMenuOpen}
          aria-controls="siteNav"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <Image src="/assets/img/jovenesfr-logo.png" alt="Jóvenes FR" width={110} height={22} />
        <small>
          MEJOR QUE DECIR, una plataforma de escucha de Jóvenes FR.
          <br />
          Los resultados públicos se presentan de forma agregada.
        </small>
        <Link className="site-footer__admin" href="/admin">
          Panel de administración
        </Link>
      </div>
    </footer>
  );
}
