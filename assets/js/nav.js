/**
 * Inyecta el header y el footer compartidos en cada página, maneja el
 * menú móvil y el selector de modo claro/oscuro. El único logo que se
 * usa en todo el sitio es el de Jóvenes FR.
 *
 * El modo claro/oscuro en sí (los colores) ya vive en styles.css, en dos
 * capas: si nunca se tocó el selector, el sitio sigue el modo del
 * sistema operativo (@media prefers-color-scheme); en cuanto se toca acá
 * una vez, se guarda la elección en localStorage y de ahí en más manda
 * por sobre el sistema (vía el atributo data-theme en <html>) hasta que
 * se vuelva a tocar. Cada página además tiene, antes de cargar
 * styles.css, un script chiquito e inline que aplica esa preferencia
 * guardada apenas arranca la página — si no, se vería primero el tema
 * por default y recién después, cuando termina de cargar este archivo,
 * el tema elegido (un "flash" del tema equivocado).
 */
(function () {
  const THEME_KEY = "mqd_theme"; // "light" | "dark" | ausente (sigue al sistema)

  function getSavedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function setSavedTheme(theme) {
    try {
      theme ? localStorage.setItem(THEME_KEY, theme) : localStorage.removeItem(THEME_KEY);
    } catch (e) {
      // Modo privado o cuota llena: el toggle sigue funcionando en esta
      // pestaña, solo que no se acuerda la próxima visita.
    }
  }
  function effectiveTheme() {
    const saved = getSavedTheme();
    if (saved) return saved;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  function applyTheme(theme) {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
  }

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
        <button class="theme-toggle" id="themeToggle" type="button">
          <svg class="theme-toggle__sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          <svg class="theme-toggle__moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        </button>
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

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
      const syncThemeButton = () => {
        const isDark = effectiveTheme() === "dark";
        themeToggle.classList.toggle("is-dark", isDark);
        const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
        themeToggle.setAttribute("aria-label", label);
        themeToggle.title = label;
      };
      syncThemeButton();
      themeToggle.addEventListener("click", () => {
        setSavedTheme(effectiveTheme() === "dark" ? "light" : "dark");
        applyTheme(getSavedTheme());
        syncThemeButton();
      });
    }

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
