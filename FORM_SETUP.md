# Cómo conectar el Google Form (paso a paso)

El sitio **no tiene backend propio**: todo el "motor" de datos es un
**Google Form** que carga respuestas en una **Google Sheet**, y el sitio lee
esa planilla publicada en formato CSV. Nadie tiene que tocar código para
que el mapa y la síntesis se actualicen: alcanza con que la gente responda
el formulario.

Este instructivo lleva ~10 minutos y lo puede hacer cualquier persona con
una cuenta de Google, sin saber programar.

---

## 1) Crear el formulario

1. Andá a [forms.google.com](https://forms.google.com) → **Formulario en blanco**.
2. Título: **MEJOR QUE DECIR — Encuentro Nacional de Jóvenes FR**.
3. Descripción sugerida: *"Contanos cómo se ve desde donde estás. Te toma 2 minutos."*
4. Cargá las preguntas **en este orden exacto** (los nombres deben quedar
   igual — el sitio los reconoce por el texto de la pregunta):

| # | Pregunta (copiá y pegá tal cual) | Tipo | Opciones |
|---|---|---|---|
| 1 | **¿De qué provincia sos?** | Desplegable · obligatoria | Las 24: Buenos Aires, CABA, Catamarca, Chaco, Chubut, Córdoba, Corrientes, Entre Ríos, Formosa, Jujuy, La Pampa, La Rioja, Mendoza, Misiones, Neuquén, Río Negro, Salta, San Juan, San Luis, Santa Cruz, Santa Fe, Santiago del Estero, Tierra del Fuego, Tucumán |
| 2 | **¿De qué localidad, ciudad o barrio sos?** | Respuesta corta · obligatoria | — |
| 3 | **¿Cómo calificarías la situación general de tu distrito hoy?** | Opción múltiple · obligatoria | Muy mala / Mala / Regular / Buena / Muy buena |
| 4 | **Contanos brevemente la situación de tu distrito (en pocas palabras)** | Párrafo · opcional | — |
| 5 | **¿Cuáles son los principales problemas de la juventud en tu lugar? (elegí hasta 3)** | Casillas · obligatoria | Falta de empleo / trabajo precario · Falta de oportunidades educativas · Salud mental · Inseguridad / violencia · Consumo problemático de sustancias · Falta de acceso a la vivienda · Falta de espacios de participación y recreación · Transporte público deficiente · Falta de acceso a tecnología / conectividad · Falta de arraigo (los jóvenes se van del distrito) |
| 6 | **¿Qué necesitan los y las jóvenes de tu distrito para desarrollarse? (elegí hasta 3)** | Casillas · obligatoria | Más oportunidades laborales · Formación y capacitación profesional · Apoyo a la salud mental · Espacios de participación política y comunitaria · Infraestructura deportiva y cultural · Acceso a créditos o vivienda propia · Mejor transporte público · Becas y acceso a la educación superior · Conectividad y acceso a tecnología · Programas de prevención de adicciones |
| 7 | **¿Qué tan optimista sos sobre el futuro del país?** | Opción múltiple · obligatoria | Muy pesimista / Pesimista / Ni pesimista ni optimista / Optimista / Muy optimista |
| 8 | **En una frase: ¿qué país te gustaría construir?** | Respuesta corta · opcional | — |
| 9 | **¿Cuál es tu edad?** | Opción múltiple · obligatoria | Menos de 18 / 18 a 24 / 25 a 30 / Más de 30 |
| 10 | **¿Participás en algún espacio de Jóvenes FR u otro espacio de militancia?** | Opción múltiple · obligatoria | Sí / No / Todavía no, pero me gustaría |
| 11 | **Nombre (opcional)** | Respuesta corta · opcional | — |

> 💡 En las preguntas de **Casillas** (5 y 6), limitá a 3 con el menú ⋮ →
> **Limitar cantidad de respuestas**.
>
> ⚠️ No uses comas ( , ) dentro del texto de las opciones — el sitio separa
> las respuestas de las casillas por coma. Si agregás una opción "Otro",
> mantenela igual, sin comas.

---

## 2) Conseguir los dos links del formulario

Con el formulario abierto en modo edición, tocá el botón **Enviar** (ícono
de avión de papel, arriba a la derecha):

- **Link para compartir**: quedá en la pestaña con el ícono 🔗. Copiá esa
  URL → es tu `googleFormUrl`.
- **Link para incrustar**: andá a la pestaña `<>` y copiá **solo la URL**
  que está dentro de `src="..."` (termina en `/viewform?embedded=true`) →
  es tu `googleFormEmbedUrl`.

---

## 3) Publicar la hoja de respuestas como CSV

1. En el editor del formulario, andá a la pestaña **Respuestas** → ícono
   verde de Sheets → **Crear hoja de cálculo**.
2. Se abre Google Sheets con una hoja llamada **"Respuestas de formulario 1"**.
3. Ahí: **Archivo → Compartir → Publicar en la Web**.
4. En el primer desplegable elegí la hoja **"Respuestas de formulario 1"**
   (no "Todo el documento"). En el segundo, elegí **Valores separados por comas (.csv)**.
5. Tocá **Publicar** → confirmá → copiá el link que te da. Es tu `csvUrl`.

> Esto **no hace pública tu Google Sheet completa** para editar: solo deja
> leer, en formato CSV de solo lectura, la hoja que elegiste.

---

## 4) Pegar los 3 links en el sitio

Abrí `assets/js/config.js` y completá:

```js
window.MQD_CONFIG = {
  ...
  googleFormUrl: "TU_LINK_DE_COMPARTIR",
  googleFormEmbedUrl: "TU_LINK_DE_INCRUSTAR",
  csvUrl: "TU_LINK_CSV_PUBLICADO",
  ...
};
```

Guardá, subí el cambio (`git commit` + `git push`, o directamente editando
el archivo desde GitHub) y listo: la encuesta queda embebida en
`encuesta.html`, y el mapa (`mapa.html`) y la síntesis (`sintesis.html`)
van a leer respuestas reales en vez de los datos de ejemplo.

---

## Preguntas frecuentes

**¿Puedo cambiar el texto de las preguntas?**
Sí, pero el sitio identifica cada pregunta buscando fragmentos de texto
clave (por ejemplo, que la pregunta 1 contenga "qué provincia"). Si cambiás
mucho la redacción, revisá `assets/js/data.js` (función `parseCsv`) y
ajustá los fragmentos de búsqueda.

**¿Qué pasa si alguien pone un nombre de provincia raro (con errores de
tipeo)?** El sitio normaliza tildes/mayúsculas, pero para evitar problemas
usá **Desplegable** (no respuesta libre) en la pregunta de provincia.

**¿Puedo agregar más preguntas?** Sí, el sitio simplemente las va a
ignorar si no las reconoce. No rompe nada.

**¿Los datos de ejemplo desaparecen solos?** Sí: en cuanto `csvUrl` tiene
un link válido y ese CSV responde, el sitio dejar de usar
`data/respuestas-demo.csv` automáticamente.
