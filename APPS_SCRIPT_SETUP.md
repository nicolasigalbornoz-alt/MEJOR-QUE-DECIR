# Cómo conectar el backend (Google Apps Script + tu planilla)

El formulario del sitio (`encuesta.html`) ya **no** usa un Google Form
embebido: es un formulario propio (con el diseño del sitio) que escribe
directo en tu Google Sheets, y que además reconoce el nombre de cada
inscripto contra el padrón del encuentro para autocompletar provincia y
ciudad. Todo esto corre con **Google Apps Script**, gratis, sin servidor
propio — y **nunca** modifica la hoja del padrón: esa hoja solo se lee,
para el autocompletado.

Las respuestas se guardan en una única hoja, "Respuestas encuesta", que se
crea sola la primera vez que alguien responde.

Este instructivo lleva ~10 minutos y lo hace cualquier persona con acceso
de edición a la planilla de trabajo (la que tiene el padrón de inscriptos).

---

## 1) Abrí el editor de Apps Script

1. Abrí la planilla: `https://docs.google.com/spreadsheets/d/1WrS0vjjeUiRk9iKyYuR1SEJcd-qjrXC6QcU7jJhlrVE/edit`
2. Menú **Extensiones → Apps Script**.
3. Se abre un editor con un archivo `Código.gs` vacío (o con `function myFunction() {}`).

## 2) Pegá el código

1. Borrá todo el contenido de `Código.gs`.
2. Copiá y pegá el contenido completo de [`apps-script/Code.gs`](apps-script/Code.gs) de este repo.
3. Guardá (ícono de disco o `Ctrl/Cmd + S`). Ponele un nombre al proyecto, por ejemplo "MEJOR QUE DECIR — backend".

## 3) Revisá el nombre de las columnas del padrón

Al principio del script hay estas líneas:

```js
const PADRON_SHEET_NAME = "Hoja 1";
const PADRON_COLS = {
  nombre: "Nombre y apellido",
  provincia: "¿De qué provincia/distrito sos?",
  ciudad: "¿De qué ciudad sos?",
};
```

`PADRON_SHEET_NAME` tiene que ser el nombre **exacto** de la pestaña
(hoja) donde están los inscriptos — mirá abajo de la planilla, las
pestañas suelen llamarse "Hoja 1", "Respuestas de formulario 1", etc.
según cómo se haya creado. Si no coincide con la realidad, el
autocompletado no encuentra a nadie (podés confirmarlo con
`?action=debug`, ver más abajo).

Verificá que `PADRON_SHEET_NAME` sea el nombre exacto de la **pestaña**
(hoja) donde están los inscriptos, y que los tres nombres de columna
coincidan con los encabezados reales de esa hoja. Si no coinciden, el
autocompletado no va a encontrar a nadie (pero la encuesta igual va a
poder guardar respuestas sin problema).

## 4) Desplegar como aplicación web

1. Arriba a la derecha, botón **Implementar → Nueva implementación**.
2. Tipo: **Aplicación web**.
3. Configuración:
   - **Ejecutar como**: Yo (tu cuenta).
   - **Quién tiene acceso**: **Cualquier usuario**.

   > ⚠️ **Ojo con esta opción**: en el desplegable hay dos parecidas —
   > **"Cualquier usuario"** (pública, sin cuenta) y **"Cualquier persona
   > que tenga una Cuenta de Google"** (pide iniciar sesión). Tenés que
   > elegir la primera; si dejás la segunda, el sitio público va a quedar
   > pidiendo login en vez de mostrar los datos.
4. Tocá **Implementar**.
5. La primera vez te va a pedir autorizar permisos: elegí tu cuenta →
   "Avanzado" → "Ir a [nombre del proyecto] (no seguro)" → Permitir. Es tu
   propio script, ese aviso es normal en Apps Script.
6. Copiá la **URL de la aplicación web** que te da al final (termina en
   `/exec`).

### Si ya tenías una implementación con el acceso mal puesto

**Implementar → Administrar implementaciones** → ícono de lápiz ✏️ de tu
implementación → arriba de todo cambiá **Versión** a **Nueva versión**
(si no, los campos de abajo quedan bloqueados y no se guarda el cambio) →
recién ahí cambiá **Quién tiene acceso** a **Cualquier usuario** →
**Implementar**. La URL `/exec` no cambia.

## 5) Pegar la URL en el sitio

Abrí `assets/js/config.js` y completá:

```js
window.MQD_CONFIG = {
  ...
  appsScriptUrl: "TU_URL_TERMINADA_EN_/exec",
  ...
};
```

Guardá, subí el cambio y listo:

- La encuesta (`encuesta.html`) ya guarda cada respuesta directo en la
  hoja **"Respuestas encuesta"** de tu planilla (se crea sola la primera vez).
- El buscador de nombre autocompleta provincia y ciudad usando el padrón,
  sin exponer teléfono, mail, fecha de nacimiento ni Instagram de nadie.
- El mapa federal y la síntesis leen esa misma hoja en vivo.

---

## Si volvés a implementar (redeploy)

Cada vez que edites `Code.gs`, tenés que crear una **nueva versión** del
despliegue para que los cambios se vean reflejados:
**Implementar → Administrar implementaciones → ✏️ (editar) → Versión: Nueva versión → Implementar**.
La URL `/exec` no cambia.

## Actas de comisión (panel de administración)

`admin.html` (link en el pie de página, "Panel de administración") deja
que los responsables de cada comisión suban el acta (Word) de su
comisión. El script las guarda en una carpeta de Drive que **se crea
sola** la primera vez ("Actas de comisiones — Mejor que decir", en la
raíz de tu Drive) y registra el link en una hoja nueva llamada "Actas"
— la síntesis (`sintesis.html`) las lista automáticamente.

Como esto usa `DriveApp` por primera vez (antes el script solo tocaba
Sheets), hay que autorizar ese permiso nuevo — **y ojo, desplegar una
"Nueva versión" del Web App NO alcanza por sí solo** para que aparezca
el cartel de autorización. Sin este paso, las subidas de actas fallan
sin ningún aviso claro (para quien sube, "no pudimos subir el
archivo"; en la planilla, ninguna fila nueva, ningún error visible).

Para autorizarlo:
1. En el editor de Apps Script, arriba (al lado de "Depurar"), elegí en
   el desplegable de funciones **`autorizarPermisoDeDrive`**.
2. Tocá **▶ Ejecutar**.
3. Ahí sí va a aparecer el cartel de autorización — elegí tu cuenta →
   "Avanzado" → "Ir a [nombre del proyecto] (no seguro)" → Permitir.
4. Con eso ya autorizado, no hace falta hacer nada más — no requiere
   una nueva implementación.
5. Esta función de paso crea la carpeta de Drive donde van a quedar las
   actas ("Actas de comisiones — Mejor que decir") y deja su link en el
   registro de ejecución: después de ejecutar, abrí el panel de
   registros (ícono de reloj/registro a la izquierda, o menú Ver >
   Registros de ejecución) para ver el link directo a esa carpeta.

El acceso a `admin.html` pide usuario/contraseña, pero **el valor real
no está en ningún archivo del sitio ni del repo** — se valida en Apps
Script (`handleAdminLogin` en `Code.gs`) contra dos Propiedades del
script que hay que cargar una sola vez, a mano:

1. En el editor de Apps Script, tocá el ícono de engranaje ⚙️
   ("Configuración del proyecto") en el menú de la izquierda.
2. Bajá hasta **"Propiedades del script"** → **"Agregar propiedad del
   script"**.
3. Agregá una propiedad `ADMIN_USER` con el usuario que quieras (por
   ejemplo `Encuentronacional`), y otra `ADMIN_PASS` con la contraseña
   (por ejemplo `JóvenesFR`). Guardá.

Con eso ya funciona — no requiere una nueva implementación, y podés
cambiar el usuario/contraseña cuando quieras editando esas dos
propiedades, sin tocar código ni el repo de GitHub.

Sigue siendo un candado liviano (no hay usuarios individuales ni
tokens con vencimiento) — sirve para que no cualquiera que pasa por el
sitio suba un archivo por error, no para proteger datos sensibles — el
acta subida tampoco queda privada, cualquiera con el link puede verla
(así el informe final puede enlazarla sin pedir cuenta de Google a
quien lo lee). Pero a diferencia de antes, ni mirando el repo público
en GitHub ni con "ver código fuente" del sitio se puede ver el usuario
o la contraseña reales.

## Panel de cupos (comisiones y talleres)

La encuesta ahora también pregunta a qué **panel/taller** le interesaría
participar a cada persona (selección única, igual que "Comisión de
interés"). La pestaña **"Panel de cupos"** de la planilla muestra en
vivo cuántos se anotaron en cada comisión (cupo 135) y cada taller
(cupo 115) — se completa sola con fórmulas que leen "Respuestas
encuesta", así que no hace falta tocar nada cada vez que llega una
respuesta nueva.

Para crearla (una sola vez):

1. Pegá el `Code.gs` actualizado (como en el paso 2 de arriba).
2. **Importante:** si la pestaña "Respuestas encuesta" ya existía de
   antes de este cambio, tiene el esquema viejo (sin la columna "Taller
   elegido") — borrala entera (clic derecho en su nombre, abajo →
   Eliminar). No hay drama si no tiene respuestas reales todavía: se
   vuelve a crear sola, con el esquema correcto, en la próxima consulta
   o respuesta.
3. En el editor de Apps Script, elegí **`crearPanelDeCupos`** en el
   desplegable de funciones (al lado de "Depurar") y tocá **▶
   Ejecutar**.
4. Volvé a implementar: **Implementar → Administrar implementaciones →
   ✏️ → Versión: Nueva versión → Implementar**.

Se puede volver a ejecutar `crearPanelDeCupos` cuando quieras (por
ejemplo si cambia algún cupo, o se agrega/saca un taller) — reconstruye
la pestaña "Panel de cupos" entera, sin tocar nunca "Respuestas
encuesta". Si cambia la lista de comisiones o talleres, hay que
actualizarla en **dos lugares que tienen que coincidir**:
`assets/js/encuesta.js` (arrays `COMISIONES` / `TALLERES`) y
`apps-script/Code.gs` (arrays `COMISIONES_CUPO` / `TALLERES_CUPO`,
cerca de `crearPanelDeCupos`).

## Si el autocompletado no encuentra a nadie

Abrí en el navegador `TU_URL_/exec?action=debug`. Te muestra a qué
planilla está atado el script, qué pestañas ve, y si encontró
`PADRON_SHEET_NAME` (con sus encabezados y cantidad de filas) — de solo
lectura, no expone filas del padrón. Es la forma más rápida de detectar
si `PADRON_SHEET_NAME` no coincide con el nombre real de la pestaña.

## Preguntas frecuentes

**¿Esto tiene algún costo?** No. Apps Script es gratis dentro de los
límites normales de una cuenta de Google personal (más que suficiente
para un encuentro de un día).

**¿Quién puede ver las respuestas?** Solo quienes tengan acceso a la
planilla de Google Sheets — el sitio público solo puede *escribir* una
respuesta nueva y *leer* la hoja "Respuestas encuesta" agregada (no el
padrón completo).

**¿Qué pasa si cambio las preguntas del formulario en el sitio?** Ajustá
en paralelo `RESPUESTA_HEADERS` y `appendResponse()` en `Code.gs`, y las
funciones de `assets/js/encuesta.js` que arman el objeto que se envía.

**¿Puedo seguir usando un Google Form en cambio?** El repo ya no incluye
esa opción (se reemplazó por este formulario propio para poder hacer el
autocompletado), pero el código es simple de adaptar si lo preferís.
