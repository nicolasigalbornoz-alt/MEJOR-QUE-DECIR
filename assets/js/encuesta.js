/**
 * Encuesta "MEJOR QUE DECIR" — formulario propio (no es un Google Form
 * embebido). Guarda cada respuesta directo en la planilla vía el Google
 * Apps Script configurado en config.js (appsScriptUrl), y ofrece un
 * buscador de nombre que autocompleta provincia/ciudad contra el padrón
 * de inscriptos (solo esos dos datos: nunca teléfono, mail, fecha de
 * nacimiento ni Instagram — ver apps-script/Code.gs).
 */
(function () {
  const K = window.MQD_FORMKIT;
  const { el, text, fieldWrap, stepHeader, radioGroup, checkboxGroup, buildProvinciaSelect, validateRequired, notConfiguredMarkup, submitToAppsScript } = K;

  const PROBLEMAS = [
    "Falta de empleo / trabajo precario",
    "Falta de oportunidades educativas",
    "Salud mental",
    "Inseguridad / violencia",
    "Consumo problemático de sustancias",
    "Falta de acceso a la vivienda",
    "Falta de espacios de participación y recreación",
    "Transporte público deficiente",
    "Falta de acceso a tecnología / conectividad",
    "Falta de arraigo (los jóvenes se van del distrito)",
  ];
  const NECESIDADES = [
    "Más oportunidades laborales",
    "Formación y capacitación profesional",
    "Apoyo a la salud mental",
    "Espacios de participación política y comunitaria",
    "Infraestructura deportiva y cultural",
    "Acceso a créditos o vivienda propia",
    "Mejor transporte público",
    "Becas y acceso a la educación superior",
    "Conectividad y acceso a tecnología",
    "Programas de prevención de adicciones",
  ];
  const SITUACION = [
    { value: 1, label: "Muy mala" },
    { value: 2, label: "Mala" },
    { value: 3, label: "Regular" },
    { value: 4, label: "Buena" },
    { value: 5, label: "Muy buena" },
  ];
  const VISION = [
    { value: -2, label: "Muy pesimista" },
    { value: -1, label: "Pesimista" },
    { value: 0, label: "Ni pesimista ni optimista" },
    { value: 1, label: "Optimista" },
    { value: 2, label: "Muy optimista" },
  ];
  const EDAD = ["Menos de 18", "18 a 24", "25 a 30", "Más de 30"];
  const PARTICIPA = ["Sí", "No", "Todavía no, pero me gustaría"];
  const MAX_MULTI = 3;

  const state = {
    formulario: "encuesta",
    nombre: "", provincia: "", localidad: "",
    situacionEscala: null, situacionTexto: "",
    problemas: [], necesidades: [],
    visionEscala: null, visionFrase: "",
    edad: "", participa: "",
  };

  // ---------- Autocompletar por nombre ----------
  function setupAutocomplete(input, onHit) {
    const cfg = window.MQD_CONFIG;
    const wrap = el("div", { class: "autocomplete" });
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const list = el("div", { class: "autocomplete__list" });
    list.hidden = true;
    wrap.appendChild(list);
    const hit = el("div", { class: "autocomplete-hit" });
    hit.hidden = true;
    wrap.parentNode.insertBefore(hit, wrap.nextSibling);

    let timer = null;
    let lastQuery = "";

    function close() { list.hidden = true; list.innerHTML = ""; }

    async function search(q) {
      if (!cfg.appsScriptUrl || !cfg.appsScriptUrl.trim()) return;
      try {
        const url = cfg.appsScriptUrl.trim().replace(/\/$/, "") + "?action=search&q=" + encodeURIComponent(q);
        const res = await fetch(url);
        if (!res.ok) return;
        const items = await res.json();
        if (q !== lastQuery) return;
        renderList(items);
      } catch (e) {
        // El autocompletado es una comodidad: si falla, no interrumpe la carga manual.
      }
    }

    function renderList(items) {
      list.innerHTML = "";
      if (!items || !items.length) { close(); return; }
      items.forEach((item) => {
        const row = el("div", { class: "autocomplete__item" }, [
          el("b", {}, [text(item.nombre)]),
          el("span", {}, [text([item.ciudad, item.provincia].filter(Boolean).join(", ") || "Sin distrito cargado")]),
        ]);
        row.addEventListener("mousedown", (e) => {
          e.preventDefault();
          input.value = item.nombre;
          close();
          hit.hidden = false;
          hit.textContent = `✓ Te reconocimos: ${item.provincia || "—"}${item.ciudad ? ", " + item.ciudad : ""}`;
          onHit(item);
        });
        list.appendChild(row);
      });
      list.hidden = false;
    }

    input.addEventListener("input", () => {
      hit.hidden = true;
      const q = input.value.trim();
      lastQuery = q;
      clearTimeout(timer);
      if (q.length < 2) { close(); return; }
      timer = setTimeout(() => search(q), 300);
    });
    document.addEventListener("click", (e) => { if (!wrap.contains(e.target)) close(); });
  }

  function buildForm() {
    const form = el("form", { class: "survey", id: "surveyForm", novalidate: "novalidate" });

    // 1) Nombre
    const nombreInput = el("input", { class: "input", type: "text", id: "fNombre", autocomplete: "name", placeholder: "Nombre y apellido" });
    nombreInput.addEventListener("input", () => { state.nombre = nombreInput.value.trim(); });
    const s1 = el("div", { class: "card" });
    s1.appendChild(stepHeader(1, "¿Quién sos?", "Buscá tu nombre: si ya estás inscripto al encuentro, te completamos provincia y ciudad solos."));
    s1.appendChild(fieldWrap("Nombre y apellido", nombreInput, { key: "nombre" }));
    form.appendChild(s1);
    setupAutocomplete(nombreInput, (item) => {
      state.nombre = item.nombre;
      if (item.provincia) {
        const matched = window.MQD_matchProvince(item.provincia);
        const p = matched && window.MQD_PROVINCE_BY_ID[matched];
        if (p) { provinciaSelect.value = p.name; state.provincia = p.name; }
      }
      if (item.ciudad) { localidadInput.value = item.ciudad; state.localidad = item.ciudad; }
    });

    // 2) De dónde sos
    const { wrap: provinciaWrap, select: provinciaSelect } = buildProvinciaSelect("f");
    provinciaSelect.addEventListener("change", () => {
      state.provincia = provinciaSelect.value;
      provinciaWrap.closest(".field")?.classList.remove("has-error");
    });
    const localidadInput = el("input", { class: "input", type: "text", id: "fLocalidad", placeholder: "Localidad, ciudad o barrio" });
    localidadInput.addEventListener("input", () => { state.localidad = localidadInput.value.trim(); });

    const s2 = el("div", { class: "card" });
    s2.appendChild(stepHeader(2, "¿De dónde sos?"));
    s2.appendChild(fieldWrap("Provincia", provinciaWrap, { key: "provincia" }));
    s2.appendChild(fieldWrap("Localidad / ciudad / barrio", localidadInput, { key: "localidad" }));
    form.appendChild(s2);

    // 3) Situación del distrito
    const situacionTexto = el("textarea", { class: "textarea", id: "fSituacionTexto", placeholder: "Contanos en pocas palabras (opcional)" });
    situacionTexto.addEventListener("input", () => { state.situacionTexto = situacionTexto.value.trim(); });
    const s3 = el("div", { class: "card" });
    s3.appendChild(stepHeader(3, "La situación de tu distrito"));
    s3.appendChild(fieldWrap("¿Cómo calificarías la situación general hoy?", radioGroup("situacion", SITUACION, (v) => { state.situacionEscala = v; }), { key: "situacionEscala" }));
    s3.appendChild(fieldWrap("Contanos brevemente (opcional)", situacionTexto));
    form.appendChild(s3);

    // 4) Problemas
    const s4 = el("div", { class: "card" });
    s4.appendChild(stepHeader(4, "Problemas de la juventud", `Elegí hasta ${MAX_MULTI} en tu lugar.`));
    const counter4 = el("div", { class: "field-counter" });
    s4.appendChild(fieldWrap(null, checkboxGroup("problemas", PROBLEMAS, state.problemas, { max: MAX_MULTI, counterEl: counter4 }), { key: "problemas", error: "Elegí al menos una opción." }));
    s4.querySelector(".field").appendChild(counter4);
    form.appendChild(s4);

    // 5) Necesidades
    const s5 = el("div", { class: "card" });
    s5.appendChild(stepHeader(5, "¿Qué necesitan los y las jóvenes?", `Elegí hasta ${MAX_MULTI}.`));
    const counter5 = el("div", { class: "field-counter" });
    s5.appendChild(fieldWrap(null, checkboxGroup("necesidades", NECESIDADES, state.necesidades, { max: MAX_MULTI, counterEl: counter5 }), { key: "necesidades", error: "Elegí al menos una opción." }));
    s5.querySelector(".field").appendChild(counter5);
    form.appendChild(s5);

    // 6) Visión país
    const visionFrase = el("input", { class: "input", type: "text", id: "fVisionFrase", placeholder: "En una frase (opcional)" });
    visionFrase.addEventListener("input", () => { state.visionFrase = visionFrase.value.trim(); });
    const s6 = el("div", { class: "card" });
    s6.appendChild(stepHeader(6, "Visión del país"));
    s6.appendChild(fieldWrap("¿Qué tan optimista sos sobre el futuro del país?", radioGroup("vision", VISION, (v) => { state.visionEscala = v; }), { key: "visionEscala" }));
    s6.appendChild(fieldWrap("¿Qué país te gustaría construir? (opcional)", visionFrase));
    form.appendChild(s6);

    // 7) Sobre vos
    const s7 = el("div", { class: "card" });
    s7.appendChild(stepHeader(7, "Un poco más sobre vos"));
    s7.appendChild(fieldWrap("Edad", radioGroup("edad", EDAD, (v) => { state.edad = v; }), { key: "edad" }));
    s7.appendChild(fieldWrap("¿Participás en algún espacio de militancia?", radioGroup("participa", PARTICIPA, (v) => { state.participa = v; }), { key: "participa" }));
    form.appendChild(s7);

    // Enviar
    const submitBtn = el("button", { class: "btn btn-primary btn-block", type: "submit" }, [text("Enviar respuesta")]);
    const msg = el("div", { class: "form-msg" });
    form.appendChild(el("div", { class: "survey-submit" }, [submitBtn, msg]));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSubmit(form, submitBtn, msg, counter4, counter5);
    });

    return form;
  }

  async function handleSubmit(form, submitBtn, msg, counter4, counter5) {
    msg.classList.remove("is-visible", "success", "error");
    const required = ["provincia", "localidad", "situacionEscala", "problemas", "necesidades", "visionEscala", "edad", "participa"];
    let firstInvalid = validateRequired(form, state, required);
    if (!state.nombre) {
      const fieldEl = form.querySelector('[data-field="nombre"]');
      fieldEl.classList.add("has-error");
      firstInvalid = firstInvalid || fieldEl;
    }
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const cfg = window.MQD_CONFIG;
    if (!cfg.appsScriptUrl || !cfg.appsScriptUrl.trim()) {
      msg.textContent = "El sitio todavía no tiene conectado el backend (Apps Script). Ver APPS_SCRIPT_SETUP.md.";
      msg.classList.add("is-visible", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    try {
      await submitToAppsScript(state);

      form.reset();
      form.querySelectorAll(".option-card.is-checked").forEach((c) => c.classList.remove("is-checked"));
      state.nombre = ""; state.provincia = ""; state.localidad = "";
      state.situacionEscala = null; state.situacionTexto = "";
      state.problemas.length = 0; state.necesidades.length = 0;
      state.visionEscala = null; state.visionFrase = "";
      state.edad = ""; state.participa = "";
      counter4.textContent = `0/${MAX_MULTI} elegidos`;
      counter5.textContent = `0/${MAX_MULTI} elegidos`;
      msg.textContent = "¡Gracias! Tu respuesta ya se sumó al mapa y a la síntesis.";
      msg.classList.add("is-visible", "success");
      msg.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      console.error(err);
      msg.textContent = "No pudimos enviar tu respuesta (revisá tu conexión) e intentá de nuevo.";
      msg.classList.add("is-visible", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar respuesta";
    }
  }

  function init() {
    const container = document.getElementById("surveyForm");
    if (!container) return;
    const cfg = window.MQD_CONFIG;
    if (!cfg.appsScriptUrl || !cfg.appsScriptUrl.trim()) {
      container.innerHTML = notConfiguredMarkup("Encuesta en preparación.");
      return;
    }
    container.appendChild(buildForm());
  }

  document.addEventListener("DOMContentLoaded", init);
})();
