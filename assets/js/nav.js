/**
 * Inyecta el header y el footer compartidos en cada página y maneja el
 * menú móvil. El único logo que se usa en todo el sitio es el de Jóvenes FR.
 */
(function () {
  const LINKS = [
    { href: "index.html", label: "Inicio" },
    { href: "encuesta.html", label: "Encuesta" },
    { href: "mapa.html", label: "Mapa federal" },
    { href: "sintesis.html", label: "Síntesis" },
    { href: "insumos.html", label: "Insumos" },
  ];

  function currentPage() {
    return document.body.getAttribute("data-page") || "index";
  }

  function slugOf(href) { return href.replace(".html", ""); }

  function buildHeader() {
    const active = currentPage();
    const navLinks = LINKS.map(
      (l) => `<a href="${l.href}" class="${slugOf(l.href) === active ? "is-active" : ""}">
                <span class="dot"></span>${l.label}
              </a>`
    ).join("");

    return `
      <div class="site-header__bar">
        <a class="brand" href="index.html" aria-label="MEJOR QUE DECIR — Inicio">
          <img class="brand__logo" src="assets/img/jovenesfr-logo.png" alt="Jóvenes FR" />
          <span class="brand__title">MEJOR&nbsp;QUE&nbsp;DECIR</span>
        </a>
        <nav class="site-nav" id="siteNav">${navLinks}</nav>
        <button class="nav-toggle" id="navToggle" aria-label="Abrir menú" aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
    `;
  }

  function buildFooter() {
    const cfg = window.MQD_CONFIG || {};
    return `
      <div class="site-footer__inner">
        <img src="assets/img/jovenesfr-logo.png" alt="Jóvenes FR" />
        <small>
          MEJOR QUE DECIR — un proyecto de escucha de ${cfg.eventoNombre || "Jóvenes FR"}.<br />
          Datos recolectados el ${cfg.eventoFecha || ""} con consentimiento de cada participante.
        </small>
        <a class="site-footer__admin" href="admin.html">Panel de administración</a>
      </div>
    `;
  }

  function init() {
    const header = document.getElementById("site-header");
    const footer = document.getElementById("site-footer");
    if (header) header.innerHTML = buildHeader();
    if (footer) footer.innerHTML = buildFooter();

    const toggle = document.getElementById("navToggle");
    const nav = document.getElementById("siteNav");
    if (!toggle || !nav) return;

    const closeNav = () => { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); };
    const openNav = () => { nav.classList.add("is-open"); toggle.setAttribute("aria-expanded", "true"); };

    toggle.addEventListener("click", () => {
      nav.classList.contains("is-open") ? closeNav() : openNav();
    });
    nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeNav));
    document.addEventListener("click", (e) => {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) closeNav();
    });
    window.addEventListener("resize", () => { if (window.innerWidth >= 760) closeNav(); });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
