# MEJOR QUE DECIR

Sitio web de escucha del **Encuentro Nacional de Jóvenes FR** (19 de
septiembre de 2026). Encuesta a los y las jóvenes sobre su distrito, los
problemas de la juventud en su lugar, sus necesidades y su visión del país,
y convierte esas respuestas en un **mapa federal** interactivo y un
**documento de síntesis**, en tiempo real.

- 📱 Pensado mobile-first, para responderse y leerse desde el celular.
- 🎨 Estética única de **Jóvenes FR** (es el único logo que aparece en todo el sitio).
- 🗄️ Sin backend propio: el backend es un **Google Form + Google Sheets**.
- 🌗 Con modo claro y oscuro.

## Estructura del sitio

| Página | Qué hace |
|---|---|
| `index.html` | Portada: qué es el proyecto, qué se pregunta, cómo funciona. |
| `encuesta.html` | Encuesta embebida (Google Form). |
| `mapa.html` | Mapa federal: cartograma tocable, un distrito por tesela. |
| `sintesis.html` | Documento de síntesis auto-generado, con botón de descarga/impresión. |

## Cómo funciona (sin backend propio)

```
Participante responde ──▶ Google Form ──▶ Google Sheets (respuestas)
                                                 │
                                    "Publicar en la Web" como CSV
                                                 │
                                                 ▼
                              El sitio (mapa.html / sintesis.html)
                              hace fetch() del CSV y arma todo en
                              el navegador de quien lo visita.
```

No hay servidor, base de datos ni proceso manual: mientras el Google Form
esté conectado, el sitio siempre refleja las respuestas más recientes.

👉 **Para conectar tu Google Form real, seguí `FORM_SETUP.md`.**

Hasta que lo conectes, el sitio muestra **datos de ejemplo**
(`data/respuestas-demo.csv`) para que el mapa y la síntesis se vean
completos desde el primer día. Un cartel celeste avisa cuando se están
mostrando datos de ejemplo.

## Estructura de archivos

```
index.html            Portada
encuesta.html         Encuesta (embed del Google Form)
mapa.html             Mapa federal
sintesis.html         Documento de síntesis
FORM_SETUP.md         Cómo crear y conectar el Google Form (paso a paso)
data/
  respuestas-demo.csv Datos de ejemplo
assets/
  css/styles.css      Sistema de diseño compartido
  js/
    config.js         ⚙️ Único archivo que hay que editar para conectar datos reales
    provinces.js       Distritos y su posición en el mapa
    data.js             Carga y procesa el CSV (real o de ejemplo)
    nav.js              Header/footer compartidos + menú móvil
    map.js              Lógica del mapa federal
    sintesis.js          Lógica del documento de síntesis
    vendor/papaparse.min.js  Parser de CSV (autoalojado)
  img/                 Logo de Jóvenes FR + íconos
  fonts/               Tipografía Outfit (autoalojada)
```

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
- **Google Form / Sheet**: `assets/js/config.js` → ver `FORM_SETUP.md`.
- **Colores y tipografía**: variables al inicio de `assets/css/styles.css`.
- **Distritos y disposición del mapa**: `assets/js/provinces.js`.
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
