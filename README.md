# MEJOR QUE DECIR

Sitio web de escucha del **Encuentro Nacional de Jóvenes FR** (19 de
septiembre de 2026). Encuesta a los y las jóvenes sobre su distrito, los
problemas de la juventud en su lugar, sus necesidades y su visión del país,
y convierte esas respuestas en un **mapa federal** interactivo y un
**documento de síntesis**, en tiempo real.

- 📱 Pensado mobile-first, y también prolijo en computadora.
- 🎨 Estética única de **Jóvenes FR** (es el único logo que aparece en todo el sitio).
- 🗄️ Sin backend propio: el backend es **Google Sheets + Google Apps Script**.
- 🔎 La encuesta reconoce el nombre de cada inscripto contra el padrón del
  encuentro y autocompleta su provincia/ciudad.
- 🌗 Con modo claro y oscuro.

## Estructura del sitio

| Página | Qué hace |
|---|---|
| `index.html` | Portada: qué es el proyecto, qué se pregunta, cómo funciona. |
| `encuesta.html` | Encuesta — formulario propio (no es un Google Form embebido). |
| `mapa.html` | Mapa federal interactivo (Leaflet): provincias reales, tocable/pellizcable. |
| `sintesis.html` | Documento de síntesis auto-generado, con botón de descarga/impresión. |
| `insumos.html` | Materiales para la militancia (carpetas de Drive explorables + Centros de Estudios). |
| `admin.html` | Panel de administración (link en el pie de página): los responsables de comisión suben el acta (Word) de su comisión, que se lista en la síntesis. Acceso con usuario/contraseña fijos — ver advertencia en `assets/js/admin.js`. |

## Cómo funciona (sin backend propio)

```
Participante completa el formulario propio (encuesta.html)
                    │
                    ▼ fetch() POST
      Google Apps Script (Code.gs, ver /apps-script)
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
 Guarda la fila en      Busca coincidencias de
 "Respuestas encuesta"  nombre en el padrón para
 de tu Google Sheets    autocompletar provincia/ciudad
                    │
                    ▼ fetch() GET ?action=responses
      mapa.html / sintesis.html arman todo
      en el navegador de quien los visita
```

No hay servidor propio, ni base de datos aparte, ni proceso manual: todo
corre sobre Google Sheets + Apps Script, gratis.

👉 **Para conectar tu backend real, seguí `APPS_SCRIPT_SETUP.md`.**

Hasta que lo conectes, el sitio muestra **datos de ejemplo**
(`data/respuestas-demo.csv`) para que el mapa y la síntesis se vean
completos desde el primer día, y la encuesta avisa que falta conectar el
backend. Un cartel celeste avisa cuando se están mostrando datos de ejemplo.

## Estructura de archivos

```
index.html              Portada
encuesta.html           Encuesta (formulario propio)
mapa.html               Mapa federal
sintesis.html           Documento de síntesis
insumos.html            Materiales para la militancia
admin.html              Panel de administración (subida de actas de comisión)
APPS_SCRIPT_SETUP.md    Cómo conectar el backend (paso a paso)
apps-script/
  Code.gs               Backend: guarda respuestas + autocompleta nombres
data/
  respuestas-demo.csv   Datos de ejemplo
assets/
  css/styles.css        Sistema de diseño compartido
  data/
    argentina-provincias.geojson  Polígonos reales de las 23 provincias
  js/
    config.js           ⚙️ Único archivo que hay que editar para conectar datos reales
    provinces.js         Distritos (id/nombre/región) + centroide de CABA
    data.js               Carga y procesa las respuestas (Apps Script, CSV o demo)
    nav.js                Header/footer compartidos + menú móvil
    formkit.js            Motor compartido de formularios (tarjetas de opción, escala lineal, etc.)
    encuesta.js           Encuesta (un solo formulario: distrito, problemas/necesidades, comisión de interés, visión país) + autocompletado por nombre
    map.js                Mapa interactivo (Leaflet + GeoJSON + CABA como punto)
    sintesis.js            Lógica del documento de síntesis
    vendor/
      papaparse.min.js     Parser de CSV (autoalojado)
      leaflet/             Librería de mapas (autoalojada, sin API key)
  img/                   Logo de Jóvenes FR + íconos
  fonts/                 Tipografía Outfit (autoalojada)
```

### El mapa

Usa **Leaflet** (librería libre, sin clave de API ni facturación) con los
polígonos reales de las 23 provincias, hecho "de cero": no usa imágenes de
mapa de terceros (nada de Google/OSM/CARTO) — solo dibuja esos polígonos
propios sobre un fondo liso, así no lleva ninguna marca de agua ni depende
de un servicio externo en tiempo real. CABA se muestra como un punto en su
centroide porque no tiene forma propia en el dataset de provincias. Se
descartó la API de Google Maps a propósito: pintar provincias por cantidad
de respuestas es un mapa temático (choropleth), no un mapa de calles, y
Google Maps para eso exigiría una clave de API y una cuenta de facturación
de Google Cloud a cargo de Jóvenes FR — un costo y mantenimiento
innecesarios para este caso de uso.

**Créditos de datos geográficos**: los límites provinciales
(`assets/data/argentina-provincias.geojson`) son datos de límites
administrativos derivados de fuentes del Instituto Geográfico Nacional,
tomados de [alvarezgarcia/provincias-argentinas-geojson](https://github.com/alvarezgarcia/provincias-argentinas-geojson).
La librería de mapas es [Leaflet](https://leafletjs.com/) (licencia
BSD-2-Clause, autoalojada), que solo se usa para el pan/zoom y la
interacción — no para traer imágenes de fondo.

### La encuesta y el autocompletado

`encuesta.html` es un solo formulario propio (mismo diseño que el resto del
sitio), no un Google Form embebido — junta en un único recorrido lo que en
un momento fueron dos encuestas separadas ("Mejor que decir" y el
Relevamiento Territorial y Formativo), que terminaban preguntando
prácticamente lo mismo sobre el distrito. Al escribir el nombre, busca
coincidencias contra la hoja de inscriptos del encuentro y, si encuentra
una, autocompleta provincia y ciudad — **nunca** expone teléfono, mail,
fecha de nacimiento ni usuario de Instagram de nadie: esa búsqueda la
resuelve el propio Google Apps Script del lado del servidor, y solo
devuelve nombre + provincia + ciudad de las coincidencias. Ver
`APPS_SCRIPT_SETUP.md` para conectarlo.

## Publicar el sitio

Es un sitio 100% estático (HTML/CSS/JS sin build). Para publicarlo con
**GitHub Pages**:

1. `Settings → Pages → Source: Deploy from a branch`.
2. Elegí la rama de este proyecto y la carpeta `/ (root)`.
3. Guardá — GitHub te da una URL tipo
   `https://<usuario>.github.io/<repo>/`.

También podés arrastrar la carpeta a Netlify/Vercel, o subirla a cualquier
hosting estático: no necesita Node, PHP ni base de datos.

## Personalizar

- **Fecha / nombre del encuentro**: `assets/js/config.js` → `eventoNombre`, `eventoFecha`.
- **Backend (Apps Script / Sheets)**: `assets/js/config.js` → ver `APPS_SCRIPT_SETUP.md`.
- **Preguntas de la encuesta**: `assets/js/encuesta.js` (arrays `PROBLEMAS`, `NECESIDADES`, etc.) — si las cambiás, actualizá también `apps-script/Code.gs`.
- **Colores y tipografía**: variables al inicio de `assets/css/styles.css`.
- **Distritos y región de cada uno**: `assets/js/provinces.js`. Los polígonos del mapa están en `assets/data/argentina-provincias.geojson`.
- **Logo**: `assets/img/jovenesfr-logo.png`, extraído del manual de marca
  oficial de Jóvenes FR (vectorial, alta resolución). No se agregó ningún
  otro logo ni isologo al sitio.

## Probarlo en local

No hace falta instalar nada. Desde la carpeta del proyecto:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

---

_MEJOR QUE DECIR — Jóvenes FR_
