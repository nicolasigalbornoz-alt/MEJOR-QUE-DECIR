/**
 * Motor compartido de formularios propios del sitio (usado por
 * encuesta.js). Genera los mismos componentes visuales — tarjetas de
 * opción para radios/checkboxes, campos de texto, escala lineal — para
 * que todos los formularios del sitio se vean y se comporten igual.
 */
window.MQD_FORMKIT = (function () {
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v);
    });
    (children || []).forEach((c) => node.appendChild(c));
    return node;
  }
  function text(t) { return document.createTextNode(t); }

  function fieldWrap(labelText, controlNode, opts) {
    opts = opts || {};
    const wrap = el("div", { class: "field", "data-field": opts.key || "" });
    if (labelText) wrap.appendChild(el("label", { class: "field-label" }, [text(labelText)]));
    wrap.appendChild(controlNode);
    if (opts.hint) wrap.appendChild(el("p", { class: "muted small", style: "margin:6px 0 0;" }, [text(opts.hint)]));
    wrap.appendChild(el("p", { class: "field-error" }, [text(opts.error || "Este campo es obligatorio.")]));
    return wrap;
  }

  function stepHeader(num, title, hint) {
    const frag = document.createDocumentFragment();
    frag.appendChild(
      el("div", { class: "survey-step__title" }, [
        el("span", { class: "survey-step__num" }, [text(String(num))]),
        text(title),
      ])
    );
    if (hint) frag.appendChild(el("p", { class: "survey-step__hint muted small" }, [text(hint)]));
    return frag;
  }

  function checkSvg() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "3");
    svg.setAttribute("stroke-linecap", "round");
    svg.innerHTML = '<path d="M20 6 9 17l-5-5"/>';
    return svg;
  }

  function radioGroup(name, options, onPick) {
    const list = el("div", { class: "option-list", role: "radiogroup" });
    options.forEach((opt) => {
      const value = typeof opt === "object" ? opt.value : opt;
      const label = typeof opt === "object" ? opt.label : opt;
      const input = el("input", { type: "radio", name });
      const card = el("label", { class: "option-card" }, [
        input,
        el("span", { class: "option-card__box round" }, [el("span", { class: "dot" })]),
        el("span", { class: "option-card__label" }, [text(label)]),
      ]);
      input.addEventListener("change", () => {
        list.querySelectorAll(".option-card").forEach((c) => c.classList.remove("is-checked"));
        card.classList.add("is-checked");
        onPick(value);
        list.closest(".field")?.classList.remove("has-error");
      });
      list.appendChild(card);
    });
    return list;
  }

  // max = null/0 => sin tope de selecciones.
  function checkboxGroup(name, options, arr, opts) {
    opts = opts || {};
    const max = opts.max || 0;
    const counterEl = opts.counterEl || null;
    const onOther = opts.onOther || null; // (checked) => void, para la opción "Otra..."
    const list = el("div", { class: "option-list", role: "group" });

    function refreshCounter() {
      if (counterEl) counterEl.textContent = `${arr.length}/${max} elegidos`;
      if (max) {
        list.querySelectorAll(".option-card").forEach((card) => {
          const isChecked = card.classList.contains("is-checked");
          card.classList.toggle("is-disabled", !isChecked && arr.length >= max);
        });
      }
    }

    options.forEach((label) => {
      const isOther = onOther && /^otra/i.test(label);
      const input = el("input", { type: "checkbox", name });
      const card = el("label", { class: "option-card" }, [
        input,
        el("span", { class: "option-card__box square" }, [checkSvg()]),
        el("span", { class: "option-card__label" }, [text(label)]),
      ]);
      input.addEventListener("change", () => {
        if (input.checked) {
          if (max && arr.length >= max) { input.checked = false; return; }
          arr.push(label);
          card.classList.add("is-checked");
        } else {
          const i = arr.indexOf(label);
          if (i >= 0) arr.splice(i, 1);
          card.classList.remove("is-checked");
        }
        if (isOther) onOther(input.checked);
        refreshCounter();
        list.closest(".field")?.classList.remove("has-error");
      });
      list.appendChild(card);
    });
    refreshCounter();
    return list;
  }

  function linearScale(name, min, max, minLabel, maxLabel, onPick) {
    const wrap = el("div", { class: "linear-scale" });
    const row = el("div", { class: "linear-scale__row" });
    for (let v = min; v <= max; v++) {
      const input = el("input", { type: "radio", name });
      const card = el("label", { class: "linear-scale__opt" }, [input, el("span", {}, [text(String(v))])]);
      input.addEventListener("change", () => {
        row.querySelectorAll(".linear-scale__opt").forEach((c) => c.classList.remove("is-checked"));
        card.classList.add("is-checked");
        onPick(v);
        wrap.closest(".field")?.classList.remove("has-error");
      });
      row.appendChild(card);
    }
    wrap.appendChild(row);
    wrap.appendChild(
      el("div", { class: "linear-scale__labels" }, [
        el("span", {}, [text(`${min} = ${minLabel}`)]),
        el("span", {}, [text(`${max} = ${maxLabel}`)]),
      ])
    );
    return wrap;
  }

  function buildProvinciaSelect(idPrefix) {
    const wrap = el("div", { class: "select-wrap" });
    const select = el("select", { class: "select", id: (idPrefix || "f") + "Provincia" }, [
      el("option", { value: "" }, [text("Elegí tu provincia…")]),
      ...window.MQD_PROVINCES.map((p) => el("option", { value: p.name }, [text(p.name)])),
    ]);
    wrap.appendChild(select);
    return { wrap, select };
  }

  function validateRequired(form, state, keys) {
    let firstInvalid = null;
    keys.forEach((key) => {
      const val = state[key];
      const isEmpty = Array.isArray(val) ? val.length === 0 : val === null || val === undefined || val === "";
      const fieldEl = form.querySelector(`[data-field="${key}"]`);
      if (!fieldEl) return;
      fieldEl.classList.toggle("has-error", isEmpty);
      if (isEmpty && !firstInvalid) firstInvalid = fieldEl;
    });
    return firstInvalid;
  }

  function notConfiguredMarkup(title) {
    return `
      <div class="form-not-configured">
        <p><b>${title || "Formulario en preparación."}</b><br />Falta conectar el backend (Google Apps Script) en <code>assets/js/config.js</code>.</p>
        <p class="muted">Mirá <code>APPS_SCRIPT_SETUP.md</code> para conectarlo en unos minutos.</p>
      </div>`;
  }

  async function submitToAppsScript(payload) {
    const cfg = window.MQD_CONFIG;
    const res = await fetch(cfg.appsScriptUrl.trim(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    let ok = res.ok;
    try { const json = await res.json(); ok = ok && json.ok !== false; } catch (e) { /* respuesta no-JSON: asumimos éxito si HTTP fue ok */ }
    if (!ok) throw new Error("La respuesta del servidor no fue exitosa.");
  }

  return {
    el, text, fieldWrap, stepHeader, radioGroup, checkboxGroup, linearScale,
    buildProvinciaSelect, validateRequired, notConfiguredMarkup, submitToAppsScript,
  };
})();
