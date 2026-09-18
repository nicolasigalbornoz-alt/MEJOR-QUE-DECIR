/**
 * Panel de administración — acceso simple para que los responsables de
 * cada comisión suban el acta (Word) de su comisión, que después se
 * lista en la síntesis como parte del informe final.
 *
 * El usuario/contraseña se validan en el backend (Apps Script,
 * handleAdminLogin en Code.gs) — NO están en este archivo ni en ningún
 * otro archivo del sitio, así que no aparecen ni mirando el repo
 * público en GitHub ni con "ver código fuente" del navegador. Sigue
 * siendo un candado liviano (no hay usuarios individuales, ni tokens
 * con vencimiento) — sirve para que no cualquiera que pasa por la
 * página suba un archivo por error, no para proteger datos sensibles.
 * El archivo subido tampoco es privado: cualquiera con el link puede
 * verlo (así el informe final puede enlazarlo sin pedirle cuenta de
 * Google a quien lo lee).
 */
(function () {
  const K = window.MQD_FORMKIT;
  const { el, text, fieldWrap, submitToAppsScript } = K;

  // Guarda el usuario/contraseña que la persona tipeó al loguearse (no un
  // token): hace falta reenviarlos con cada subida de acta, porque el
  // servidor los vuelve a chequear ahí también (ver comentario en
  // verificarCredencialesAdmin de Code.gs) — si solo se guardara un
  // booleano "logueado sí/no", alguien podría copiar el pedido de subida
  // desde la red del navegador y mandarlo sin haber pasado nunca por acá.
  const SESSION_KEY = "mqd_admin_session";
  // OJO: Apps Script recibe el archivo como base64 adentro de un POST que
  // además pasa por un redirect propio de Google (script.google.com ->
  // script.googleusercontent.com) — con archivos grandes ese camino se
  // pone poco confiable (falla la subida sin un motivo claro). 8MB es un
  // techo conservador para que ande bien de verdad; un acta en Word con
  // texto normal pesa muchísimo menos que eso.
  const MAX_MB = 8;
  const WARN_MB = 3; // a partir de acá, avisamos que puede tardar

  // Lista compartida — ver assets/js/comisiones.js.
  const COMISIONES = window.MQD_COMISIONES;

  function getSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.usuario && parsed.clave ? parsed : null;
    } catch (err) {
      return null;
    }
  }
  function setSession(creds) {
    try {
      creds ? sessionStorage.setItem(SESSION_KEY, JSON.stringify(creds)) : sessionStorage.removeItem(SESSION_KEY);
    } catch (err) { /* modo privado: sigue funcionando, solo no recuerda entre recargas */ }
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

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Los archivos grandes por este camino (POST con el archivo en base64,
  // pasando por el redirect propio de Apps Script) a veces fallan por una
  // sola vez sin motivo claro — un reintento corto resuelve la mayoría de
  // esos casos sin marear a quien está subiendo el acta con un error que
  // en realidad era pasajero.
  async function uploadActaConReintento(payload) {
    try {
      await submitToAppsScript(payload);
    } catch (err) {
      await sleep(1200);
      await submitToAppsScript(payload);
    }
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

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      msg.classList.remove("is-visible", "success", "error");

      const cfg = window.MQD_CONFIG;
      if (!cfg.appsScriptUrl || !cfg.appsScriptUrl.trim()) {
        msg.textContent = "El sitio todavía no tiene conectado el backend (Apps Script).";
        msg.classList.add("is-visible", "error");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Ingresando…";
      try {
        // La validación real pasa en Apps Script (handleAdminLogin): acá
        // solo mandamos lo que se tipeó, nunca comparamos contra nada
        // hardcodeado en este archivo.
        const usuario = userInput.value.trim();
        const clave = passInput.value;
        await submitToAppsScript({ tipo: "adminLogin", usuario, clave });
        // Guardamos usuario/clave (no un booleano) para poder reenviarlos
        // con cada subida de acta — ver comentario junto a SESSION_KEY.
        setSession({ usuario, clave });
        onSuccess();
      } catch (err) {
        console.error(err);
        // Si el servidor respondió con un motivo concreto (usuario/clave
        // incorrectos, o que falta configurar las Propiedades del
        // script), lo mostramos tal cual — más útil que un genérico.
        msg.textContent = /respuesta del servidor/i.test(err.message || "")
          ? err.message
          : "No pudimos verificar el usuario (revisá tu conexión) e intentá de nuevo.";
        msg.classList.add("is-visible", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "Ingresar";
      }
    });

    card.appendChild(form);
    return card;
  }

  function buildUpload(onLogout, session) {
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
    const sizeHint = el("p", { class: "muted small", style: "margin:6px 0 0; display:none;" });
    fileInput.addEventListener("change", () => {
      const f = fileInput.files[0];
      if (f && f.size > WARN_MB * 1024 * 1024) {
        sizeHint.textContent = "Archivo pesado: puede tardar unos segundos en subir, no cierres la página.";
        sizeHint.style.display = "block";
      } else {
        sizeHint.style.display = "none";
      }
    });

    const msg = el("div", { class: "form-msg" });
    const btn = el("button", { class: "btn btn-primary btn-block", type: "submit" }, [text("Subir acta")]);

    const fArchivo = fieldWrap("Archivo (Word)", fileInput, { key: "archivo", error: "Elegí un archivo." });
    fArchivo.appendChild(sizeHint);

    const form = el("form", { novalidate: "novalidate" }, [
      fieldWrap("Comisión", selectWrap, { key: "comision", error: "Elegí tu comisión." }),
      fArchivo,
      el("div", { class: "survey-submit" }, [btn, msg]),
    ]);

    logoutBtn.addEventListener("click", () => { setSession(null); onLogout(); });

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
        await uploadActaConReintento({
          tipo: "acta",
          comision,
          archivoNombre: file.name,
          mimeType: file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          archivoBase64,
          // El servidor vuelve a chequear esto en cada subida, no solo en
          // el login — ver comentario junto a SESSION_KEY.
          usuario: session.usuario,
          clave: session.clave,
        });
        form.reset();
        sizeHint.style.display = "none";
        msg.textContent = "¡Listo! El acta ya se subió y va a aparecer en la síntesis.";
        msg.classList.add("is-visible", "success");
      } catch (err) {
        console.error(err);
        // Si el error trae un motivo concreto del servidor (por ejemplo un
        // permiso de Drive que falta autorizar), lo mostramos tal cual —
        // mucho más útil para saber qué pasa de verdad que un mensaje
        // genérico de "revisá tu conexión".
        const esErrorDelServidor = err && /respuesta del servidor/i.test(err.message || "");
        if (esErrorDelServidor) {
          msg.textContent = "No pudimos subir el archivo: " + err.message;
        } else {
          msg.textContent = file.size > WARN_MB * 1024 * 1024
            ? "No pudimos subir el archivo. Con archivos pesados a veces falla — probá de nuevo, o con uno más liviano si se repite."
            : "No pudimos subir el archivo (revisá tu conexión) e intentá de nuevo.";
        }
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
      const session = getSession();
      if (!session) { showLogin(); return; }
      loginCard.hidden = true;
      loginCard.innerHTML = "";
      uploadCard.hidden = false;
      uploadCard.innerHTML = "";
      uploadCard.appendChild(buildUpload(showLogin, session));
    }

    if (getSession()) showUpload();
    else showLogin();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
