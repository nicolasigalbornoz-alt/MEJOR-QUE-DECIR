/**
 * MEJOR QUE DECIR — configuración central.
 *
 * Editá SOLO este archivo para conectar el sitio con tu Google Form real.
 * Instrucciones completas: /FORM_SETUP.md
 */
window.MQD_CONFIG = {
  // Nombre del encuentro y fecha (se muestran en todo el sitio).
  eventoNombre: "Encuentro Nacional de Jóvenes FR",
  eventoFecha: "19 de septiembre de 2026",

  // 1) Pegá acá el link "Enviar" de tu Google Form (para el botón "Abrir encuesta").
  //    Se obtiene con el botón "Enviar" (ícono de avión) del editor del formulario.
  googleFormUrl: "https://forms.gle/REEMPLAZAR-CON-TU-FORMULARIO",

  // 2) Pegá acá el link de INCRUSTAR (embed) del mismo formulario.
  //    En el editor: Enviar → pestaña "<>" → copiá la URL del atributo src del iframe.
  //    Termina en "/viewform?embedded=true".
  googleFormEmbedUrl: "https://docs.google.com/forms/d/e/REEMPLAZAR/viewform?embedded=true",

  // 3) Pegá acá el link CSV publicado de la hoja de respuestas del formulario.
  //    En Google Sheets: Archivo → Compartir → Publicar en la Web → elegí la
  //    hoja "Respuestas de formulario 1" → formato CSV → Publicar → copiá el link.
  csvUrl: "",

  // Mientras csvUrl esté vacío (o no responda), el sitio muestra datos de
  // ejemplo para que el mapa y la síntesis se vean completos desde el día 1.
  // Pasá esto a false solo si preferís que el sitio quede vacío sin datos reales.
  useDemoFallback: true,
  demoCsvPath: "data/respuestas-demo.csv",
};
