/**
 * Animaciones de entrada al hacer scroll: tarjetas, filas de barras,
 * estadísticas y demás bloques aparecen con un fade + leve desplazamiento
 * en vez de aparecer de golpe. Puramente cosmético.
 *
 * Importante: nunca debe dejar contenido real invisible. Por eso, además
 * del IntersectionObserver (que da el efecto lindo al scrollear normal),
 * hay dos redes de seguridad: un listener de scroll/resize que revela
 * cualquier elemento que haya quedado a la vista (o ya pasado por arriba,
 * por ej. un salto instantáneo con un link de anclaje o "Buscar en la
 * página"), y un timeout final que muestra todo lo que quede pendiente
 * pase lo que pase.
 *
 * Respeta prefers-reduced-motion: si la persona pidió menos movimiento,
 * no se anima nada y el contenido queda visible desde el principio.
 */
(function () {
  const prefersReduced =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Qué se anima. Cubre tanto el contenido fijo de cada página (cards,
  // features, timeline) como el que arman map.js / sintesis.js / data.js
  // en tiempo de ejecución (stat-row, bar-row, chip, testimonios).
  const SELECTOR = [
    ".card",
    ".feature",
    ".stat-row",
    ".bar-row",
    ".timeline li",
    ".testimonio",
    ".diverging-row",
    ".chip-row",
  ].join(", ");

  if (prefersReduced || !("IntersectionObserver" in window)) return;

  const seen = new WeakSet();
  const delayCount = new WeakMap(); // por padre, cuántos hijos ya recibieron delay
  let pending = [];

  function reveal(el) {
    el.classList.add("is-visible");
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        reveal(entry.target);
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -10% 0px" }
  );

  function prepare(el) {
    if (seen.has(el)) return;
    seen.add(el);
    el.classList.add("reveal");
    // Escalonado suave dentro de un mismo contenedor (ej. las 6 cards de
    // "Qué preguntamos", o cada bar-row de un ranking), tope de 5 pasos
    // para no demorar de más los elementos que están más abajo.
    const parent = el.parentElement;
    const n = Math.min(delayCount.get(parent) || 0, 5);
    delayCount.set(parent, n + 1);
    if (n > 0) el.style.transitionDelay = n * 55 + "ms";
    io.observe(el);
    pending.push(el);
  }

  function scan(root) {
    (root.matches && root.matches(SELECTOR) ? [root] : []).forEach(prepare);
    root.querySelectorAll && root.querySelectorAll(SELECTOR).forEach(prepare);
  }

  // Red de seguridad #1: si un salto de scroll instantáneo (link de
  // anclaje, scroll programático, Ctrl+F) deja a un elemento ya visible
  // o ya pasado por arriba sin que el IntersectionObserver llegue a
  // "verlo" cruzar el umbral, esto lo revela igual.
  let ticking = false;
  function sweep() {
    ticking = false;
    pending = pending.filter((el) => {
      if (el.classList.contains("is-visible")) return false;
      if (el.getBoundingClientRect().top < window.innerHeight) {
        reveal(el);
        io.unobserve(el);
        return false;
      }
      return true;
    });
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(sweep);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  // Red de seguridad #2: pase lo que pase, después de unos segundos se
  // muestra todo lo que haya quedado pendiente. El contenido nunca debe
  // depender de la animación para poder verse.
  setTimeout(() => {
    pending.forEach(reveal);
    pending = [];
  }, 4000);

  function init() {
    const main = document.querySelector("main");
    if (!main) return;
    scan(main);
    sweep();

    // El mapa, la síntesis y los insumos arman gran parte de su contenido
    // con JS después de que carguen los datos (fetch al backend / demo
    // fallback) — un MutationObserver agarra esos nodos apenas aparecen.
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scan(node);
        });
      });
      sweep();
    });
    mo.observe(main, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
