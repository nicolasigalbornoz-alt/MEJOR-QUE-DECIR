/**
 * Listas de comisiones y talleres del encuentro — compartidas por
 * encuesta.js (pregunta de la encuesta), admin.js (desplegable al subir
 * un acta) y sintesis.js (piezas del rompecabezas de comisiones). Antes
 * cada archivo tenía su propia copia y había que acordarse de tocar los
 * 3 a la vez; ahora solo hay un lugar del lado del sitio.
 *
 * OJO: Apps Script (apps-script/Code.gs) es un runtime aparte y no puede
 * importar este archivo — sus propias copias (COMISIONES_CUPO /
 * TALLERES_CUPO, usadas por crearPanelDeCupos) hay que actualizarlas a
 * mano si esta lista cambia.
 */
window.MQD_COMISIONES = [
  "Trabajo y situación económica",
  "Modelo de desarrollo, producción y federalismo",
  "Soberanía, tierra y defensa",
  "Inteligencia artificial, plataformas y poder: una mirada desde el Sur Global",
  "Seguridad",
  "Educación",
  "Salud mental",
  "Vivienda, hábitat y urbanismo",
  "Militancia en el siglo XXI",
];

window.MQD_TALLERES = [
  "Pensar en la Argentina Bicontinental: Malvinas, Antártida y Atlántico Sur",
  "Gestión Municipal",
  "Política legislativa",
  "Comunicación política y redes",
  "Historia del movimiento peronista",
  "Seguridad",
  "Economía",
];
