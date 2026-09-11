/**
 * Relevamiento Territorial y Formativo — formulario propio (mismo motor
 * que encuesta.js, ver formkit.js). Formulario de registro y diagnóstico
 * territorial para coordinar acciones, áreas de trabajo y propuestas
 * locales. Guarda cada respuesta en la hoja "Relevamiento territorial"
 * de la planilla, vía el mismo Google Apps Script de config.js.
 */
(function () {
  const K = window.MQD_FORMKIT;
  const { el, text, fieldWrap, stepHeader, checkboxGroup, linearScale, buildProvinciaSelect, validateRequired, notConfiguredMarkup, submitToAppsScript } = K;

  const COMISIONES = [
    "Organización y Política Territorial",
    "Obras Públicas, Hábitat y Transporte",
    "Ambiente y Desarrollo Sustentable",
    "Economía, Hacienda y Producción",
    "Salud y Acción Social",
    "Educación, Ciencia y Cultura",
    "Juventud",
    "Seguridad y Derechos Humanos",
    "Otra...",
  ];

  const state = {
    formulario: "relevamiento",
    nombreCompleto: "",
    provincia: "",
    localidad: "",
    espacioPolitico: "",
    comisiones: [],
    comisionOtra: "",
    problematica: "",
    situacionEscala: null,
    situacionDetalle: "",
  };

  function buildForm() {
    const form = el("form", { class: "survey", id: "relevamientoForm", novalidate: "novalidate" });

    // 1) Nombre completo
    const nombreInput = el("input", { class: "input", type: "text", id: "rNombre", autocomplete: "name", placeholder: "Nombre y apellido" });
    nombreInput.addEventListener("input", () => { state.nombreCompleto = nombreInput.value.trim(); });
    const s1 = el("div", { class: "card" });
    s1.appendChild(stepHeader(1, "Nombre completo"));
    s1.appendChild(fieldWrap(null, nombreInput, { key: "nombreCompleto" }));
    form.appendChild(s1);

    // 2) Provincia
    const { wrap: provinciaWrap, select: provinciaSelect } = buildProvinciaSelect("r");
    provinciaSelect.addEventListener("change", () => {
      state.provincia = provinciaSelect.value;
      provinciaWrap.closest(".field")?.classList.remove("has-error");
    });
    const s2 = el("div", { class: "card" });
    s2.appendChild(stepHeader(2, "Provincia"));
    s2.appendChild(fieldWrap(null, provinciaWrap, { key: "provincia" }));
    form.appendChild(s2);

    // 3) Localidad
    const localidadInput = el("input", { class: "input", type: "text", id: "rLocalidad", placeholder: "Municipio, partido o localidad" });
    localidadInput.addEventListener("input", () => { state.localidad = localidadInput.value.trim(); });
    const s3 = el("div", { class: "card" });
    s3.appendChild(stepHeader(3, "Localidad"));
    s3.appendChild(fieldWrap(null, localidadInput, { key: "localidad", hint: "Indicá el municipio, partido o localidad donde residís o ejercés tu actividad." }));
    form.appendChild(s3);

    // 4) Espacio político
    const espacioInput = el("input", { class: "input", type: "text", id: "rEspacio", placeholder: "Espacio, agrupación o referencia política" });
    espacioInput.addEventListener("input", () => { state.espacioPolitico = espacioInput.value.trim(); });
    const s4 = el("div", { class: "card" });
    s4.appendChild(stepHeader(4, "Espacio político"));
    s4.appendChild(fieldWrap(null, espacioInput, { key: "espacioPolitico" }));
    form.appendChild(s4);

    // 5) Comisión de interés
    const otraInput = el("input", { class: "input", type: "text", placeholder: "Contanos cuál", style: "margin-top:8px; display:none;" });
    otraInput.addEventListener("input", () => { state.comisionOtra = otraInput.value.trim(); });
    const s5 = el("div", { class: "card" });
    s5.appendChild(stepHeader(5, "Comisión de interés", "Elegí una o más."));
    const comisionesGroup = checkboxGroup("comisiones", COMISIONES, state.comisiones, {
      onOther: (checked) => { otraInput.style.display = checked ? "block" : "none"; if (!checked) { otraInput.value = ""; state.comisionOtra = ""; } },
    });
    const f5 = fieldWrap(null, comisionesGroup, { key: "comisiones", error: "Elegí al menos una comisión." });
    f5.appendChild(otraInput);
    s5.appendChild(f5);
    form.appendChild(s5);

    // 6) Problemática de tu localidad
    const problematicaText = el("textarea", { class: "textarea", id: "rProblematica", placeholder: "Describí el principal problema detectado en tu distrito" });
    problematicaText.addEventListener("input", () => { state.problematica = problematicaText.value.trim(); });
    const s6 = el("div", { class: "card" });
    s6.appendChild(stepHeader(6, "Una problemática de tu localidad"));
    s6.appendChild(fieldWrap(null, problematicaText, { key: "problematica", hint: "Sintetizá el principal problema detectado en tu distrito (ej. infraestructura, transporte, servicios públicos, empleo, etc.)." }));
    form.appendChild(s6);

    // 7) Situación del distrito (escala + detalle)
    const detalleText = el("textarea", { class: "textarea", id: "rSituacionDetalle", placeholder: "Describí la coyuntura política, económica o comunitaria del distrito" });
    detalleText.addEventListener("input", () => { state.situacionDetalle = detalleText.value.trim(); });
    const s7 = el("div", { class: "card" });
    s7.appendChild(stepHeader(7, "¿Cómo está la situación en tu distrito?"));
    s7.appendChild(fieldWrap(
      "Evaluación general",
      linearScale("situacion", 1, 5, "Muy crítica", "Muy favorable", (v) => { state.situacionEscala = v; }),
      { key: "situacionEscala" }
    ));
    s7.appendChild(fieldWrap("Detalle", detalleText, { key: "situacionDetalle" }));
    form.appendChild(s7);

    // Enviar
    const submitBtn = el("button", { class: "btn btn-primary btn-block", type: "submit" }, [text("Enviar")]);
    const msg = el("div", { class: "form-msg" });
    form.appendChild(el("div", { class: "survey-submit" }, [submitBtn, msg]));

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSubmit(form, submitBtn, msg, otraInput, comisionesGroup);
    });

    return form;
  }

  async function handleSubmit(form, submitBtn, msg, otraInput, comisionesGroup) {
    msg.classList.remove("is-visible", "success", "error");
    const required = ["nombreCompleto", "provincia", "localidad", "espacioPolitico", "comisiones", "problematica", "situacionEscala", "situacionDetalle"];
    const firstInvalid = validateRequired(form, state, required);
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

    // Si tildaron "Otra..." y escribieron el detalle, mandamos ese texto en vez del genérico.
    const payload = { ...state, comisiones: state.comisiones.map((c) => (/^otra/i.test(c) && state.comisionOtra ? `Otra: ${state.comisionOtra}` : c)) };

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    try {
      await submitToAppsScript(payload);

      form.reset();
      form.querySelectorAll(".option-card.is-checked, .linear-scale__opt.is-checked").forEach((c) => c.classList.remove("is-checked"));
      otraInput.style.display = "none";
      state.nombreCompleto = ""; state.provincia = ""; state.localidad = ""; state.espacioPolitico = "";
      state.comisiones.length = 0; state.comisionOtra = "";
      state.problematica = ""; state.situacionEscala = null; state.situacionDetalle = "";
      msg.textContent = "¡Gracias! Tu respuesta quedó registrada.";
      msg.classList.add("is-visible", "success");
      msg.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      console.error(err);
      msg.textContent = "No pudimos enviar tu respuesta (revisá tu conexión) e intentá de nuevo.";
      msg.classList.add("is-visible", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Enviar";
    }
  }

  function init() {
    const container = document.getElementById("relevamientoForm");
    if (!container) return;
    const cfg = window.MQD_CONFIG;
    if (!cfg.appsScriptUrl || !cfg.appsScriptUrl.trim()) {
      container.innerHTML = notConfiguredMarkup("Formulario en preparación.");
      return;
    }
    container.appendChild(buildForm());
  }

  document.addEventListener("DOMContentLoaded", init);
})();
