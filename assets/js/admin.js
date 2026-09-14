/**
 * Panel de administración — acceso simple para que los responsables de
 * cada comisión suban el acta (Word) de su comisión, que después se
 * lista en la síntesis como parte del informe final.
 *
 * OJO — esto es un candado liviano, no un login real: el usuario y la
 * contraseña quedan en este archivo, que es público (el sitio entero
 * está en un repo público en GitHub). Sirve para que no cualquiera que
 * pasa por la página suba un archivo por error, no para proteger datos
 * sensibles. El archivo subido tampoco es privado: cualquiera con el
 * link puede verlo (así el informe final puede enlazarlo sin pedirle
 * cuenta de Google a quien lo lee).
 */
(function () {
  const K = window.MQD_FORMKIT;
  const { el, text, fieldWrap, submitToAppsScript } = K;

  const USUARIO = "Encuentronacional";
  const CLAVE = "JóvenesFR";
  const SESSION_KEY = "mqd_admin_ok";
  const MAX_MB = 20;

  // Tiene que coincidir con la lista de comisiones de assets/js/encuesta.js.
  const COMISIONES = [
    "Trabajo y producción",
    "Modelo de desarrollo y federalismo",
    "Soberanía, defensa e integración territorial",
    "Desafíos éticos y políticos de la IA: una mirada desde el sur global",
    "Seguridad",
    "Militancia territorial",
  ];

  function getSession() {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (err) { return false; }
  }
  function setSession(v) {
    try { v ? sessionStorage.setItem(SESSION_KEY, "1") : sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* modo privado: sigue funcionando, solo no recuerda entre recargas */ }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const idx = result.indexOf(",");
        resolve(idx === -1 ? "" : result.slice(idx + 1));
      };
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(file);
    });
  }

  function buildLogin(onSuccess) {
    const card = el("div", { class: "card" });
    card.appendChild(el("h2", { class: "mt-0", style: "font-size:19px;" }, [text("Ingresar")]));

    const userInput = el("input", { class: "input", type: "text", autocomplete: "username", placeholder: "Usuario" });
    const passInput = el("input", { class: "input", type: "password", autocomplete: "current-password", placeholder: "Contraseña" });
    const msg = el("div", { class: "form-msg" });
    const btn = el("button", { class: "btn btn-primary btn-block", type: "submit" }, [text("Ingresar")]);

    const form = el("form", { novalidate: "novalidate" }, [
      fieldWrap("Usuario", userInput),
      fieldWrap("Contraseña", passInput),
      el("div", { class: "survey-submit" }, [btn, msg]),
    ]);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      msg.classList.remove("is-visible", "success", "error");
      if (userInput.value.trim() === USUARIO && passInput.value === CLAVE) {
        setSession(true);
        onSuccess();
      } else {
        msg.textContent = "Usuario o contraseña incorrectos.";
        msg.classList.add("is-visible", "error");
      }
    });

    card.appendChild(form);
    return card;
  }

  function buildUpload(onLogout) {
    const card = el("div", { class: "card" });
    const head = el("div", { style: "display:flex; align-items:center; justify-content:space-between; gap:12px;" }, [
      el("h2", { class: "mt-0", style: "font-size:19px;" }, [text("Subir acta")]),
    ]);
    const logoutBtn = el("button", { type: "button", class: "btn-ghost", style: "border:none; background:none; padding:0; font-size:13px; text-decoration:underline; cursor:pointer;" }, [text("Salir")]);
    head.appendChild(logoutBtn);
    card.appendChild(head);
    card.appendChild(el("p", { class: "muted small mt-0" }, [text("Formato Word (.doc o .docx), hasta " + MAX_MB + " MB.")]));

    const select = el("select", { class: "select" }, [
      el("option", { value: "" }, [text("Elegí tu comisión…")]),
      ...COMISIONES.map((c) => el("option", { value: c }, [text(c)])),
    ]);
    const selectWrap = el("div", { class: "select-wrap" }, [select]);

    const fileInput = el("input", {
      class: "input", type: "file",
      accept: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    const msg = el("div", { class: "form-msg" });
    const btn = el("button", { class: "btn btn-primary btn-block", type: "submit" }, [text("Subir acta")]);

    const form = el("form", { novalidate: "novalidate" }, [
      fieldWrap("Comisión", selectWrap, { key: "comision", error: "Elegí tu comisión." }),
      fieldWrap("Archivo (Word)", fileInput, { key: "archivo", error: "Elegí un archivo." }),
      el("div", { class: "survey-submit" }, [btn, msg]),
    ]);

    logoutBtn.addEventListener("click", () => { setSession(false); onLogout(); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.classList.remove("is-visible", "success", "error");

      const comision = select.value;
      const file = fileInput.files[0];
      form.querySelector('[data-field="comision"]').classList.toggle("has-error", !comision);
      form.querySelector('[data-field="archivo"]').classList.toggle("has-error", !file);
      if (!comision || !file) return;

      if (file.size > MAX_MB * 1024 * 1024) {
        msg.textContent = `El archivo pesa más de ${MAX_MB}MB — probá con uno más liviano.`;
        msg.classList.add("is-visible", "error");
        return;
      }

      const cfg = window.MQD_CONFIG;
      if (!cfg.appsScriptUrl || !cfg.appsScriptUrl.trim()) {
        msg.textContent = "El sitio todavía no tiene conectado el backend (Apps Script).";
        msg.classList.add("is-visible", "error");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Subiendo…";
      try {
        const archivoBase64 = await fileToBase64(file);
        await submitToAppsScript({
          tipo: "acta",
          comision,
          archivoNombre: file.name,
          mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          archivoBase64,
        });
        form.reset();
        msg.textContent = "¡Listo! El acta ya se subió y va a aparecer en la síntesis.";
        msg.classList.add("is-visible", "success");
      } catch (err) {
        console.error(err);
        msg.textContent = "No pudimos subir el archivo (revisá tu conexión) e intentá de nuevo.";
        msg.classList.add("is-visible", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Subir acta";
      }
    });

    card.appendChild(form);
    return card;
  }

  function init() {
    const loginCard = document.getElementById("loginCard");
    const uploadCard = document.getElementById("uploadCard");
    if (!loginCard || !uploadCard) return;

    function showLogin() {
      uploadCard.hidden = true;
      uploadCard.innerHTML = "";
      loginCard.hidden = false;
      loginCard.innerHTML = "";
      loginCard.appendChild(buildLogin(showUpload));
    }
    function showUpload() {
      loginCard.hidden = true;
      loginCard.innerHTML = "";
      uploadCard.hidden = false;
      uploadCard.innerHTML = "";
      uploadCard.appendChild(buildUpload(showLogin));
    }

    if (getSession()) showUpload();
    else showLogin();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
