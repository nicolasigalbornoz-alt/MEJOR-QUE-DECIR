/**
 * MEJOR QUE DECIR — configuración central.
 *
 * Editá SOLO este archivo para conectar el sitio con tu backend real.
 * Instrucciones completas: /APPS_SCRIPT_SETUP.md
 */
window.MQD_CONFIG = {
  // Nombre del encuentro y fecha (se muestran en todo el sitio).
  eventoNombre: "Encuentro Nacional de Jóvenes FR",
  eventoFecha: "19 de septiembre de 2026",

  // Pegá acá la URL de tu Google Apps Script publicado como aplicación
  // web (termina en "/exec"). Ver /APPS_SCRIPT_SETUP.md para crearla.
  // Con esto conectado: la encuesta guarda respuestas en tu planilla,
  // el buscador de nombre autocompleta provincia/ciudad, y el mapa +
  // la síntesis leen los datos reales.
  appsScriptUrl: "",

  // Alternativa/legado: un link CSV publicado (Google Sheets → Archivo →
  // Compartir → Publicar en la Web → CSV). Se usa solo si appsScriptUrl
  // está vacío.
  csvUrl: "",

  // Mientras no haya appsScriptUrl ni csvUrl (o no respondan), el sitio
  // muestra datos de ejemplo para que el mapa y la síntesis se vean
  // completos desde el día 1.
  useDemoFallback: true,
  demoCsvPath: "data/respuestas-demo.csv",
};
