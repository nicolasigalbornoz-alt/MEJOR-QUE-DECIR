export const COMMISSIONS = [
  { id: "trabajo-situacion-economica", name: "Trabajo y situación económica", capacity: 70 },
  { id: "modelo-desarrollo-produccion-federalismo", name: "Modelo de desarrollo, producción y federalismo", capacity: 70 },
  { id: "soberania-tierra-defensa", name: "Soberanía, tierra y defensa", capacity: 70 },
  { id: "inteligencia-artificial-plataformas-poder", name: "Inteligencia artificial, plataformas y poder: una mirada desde el Sur Global", capacity: 70 },
  { id: "seguridad", name: "Seguridad", capacity: 70 },
  { id: "educacion", name: "Educación", capacity: 70 },
  { id: "salud-mental", name: "Salud mental", capacity: 70 },
  { id: "vivienda-habitat-urbanismo", name: "Vivienda, hábitat y urbanismo", capacity: 70 },
  { id: "militancia-siglo-xxi", name: "Militancia en el siglo XXI", capacity: 70 },
] as const;

export const WORKSHOPS = [
  { id: "argentina-bicontinental", name: "Pensar en la Argentina Bicontinental: Malvinas, Antártida y Atlántico Sur", capacity: 75 },
  { id: "gestion-municipal", name: "Gestión Municipal", capacity: 75 },
  { id: "politica-legislativa", name: "Política legislativa", capacity: 75 },
  { id: "comunicacion-politica-redes", name: "Comunicación política y redes", capacity: 75 },
  { id: "historia-peronista-vol-i", name: "Historia del movimiento peronista (Vol I: gobierno de Perón y resistencia peronista)", capacity: 75 },
  { id: "historia-peronista-vol-ii", name: "Historia del movimiento peronista (Vol II: de 1970 a la actualidad)", capacity: 75 },
  { id: "seguridad", name: "Seguridad", capacity: 75 },
  { id: "economia", name: "Economía", capacity: 75 },
] as const;

export const PROBLEMS = [
  { value: "empleo", label: "Falta de empleo / trabajo precario" },
  { value: "educacion", label: "Falta de oportunidades educativas" },
  { value: "salud-mental", label: "Salud mental" },
  { value: "inseguridad", label: "Inseguridad / violencia" },
  { value: "consumo", label: "Consumo problemático de sustancias" },
  { value: "vivienda", label: "Falta de acceso a la vivienda" },
  { value: "participacion", label: "Falta de espacios de participación y recreación" },
  { value: "transporte", label: "Transporte público deficiente" },
  { value: "conectividad", label: "Falta de acceso a tecnología / conectividad" },
  { value: "arraigo", label: "Falta de arraigo (los jóvenes se van del distrito)" },
  { value: "otro", label: "Otro..." },
] as const;

export const NEEDS = [
  { value: "empleo", label: "Más oportunidades laborales" },
  { value: "formacion", label: "Formación y capacitación profesional" },
  { value: "salud-mental", label: "Apoyo a la salud mental" },
  { value: "participacion", label: "Espacios de participación política y comunitaria" },
  { value: "deporte-cultura", label: "Infraestructura deportiva y cultural" },
  { value: "vivienda", label: "Acceso a créditos o vivienda propia" },
  { value: "transporte", label: "Mejor transporte público" },
  { value: "becas", label: "Becas y acceso a la educación superior" },
  { value: "conectividad", label: "Conectividad y acceso a tecnología" },
  { value: "adicciones", label: "Programas de prevención de adicciones" },
  { value: "infraestructura", label: "Mejoras en infraestructura y servicios" },
] as const;

export const PARTICIPATION_OPTIONS = [
  { value: "Sí", label: "Sí" },
  { value: "No", label: "No" },
  { value: "Todavía no, pero me gustaría", label: "Todavía no, pero me gustaría" },
] as const;

export const SITUATION_OPTIONS = [
  { value: 1, label: "Muy mala" },
  { value: 2, label: "Mala" },
  { value: 3, label: "Regular" },
  { value: 4, label: "Buena" },
  { value: 5, label: "Muy buena" },
] as const;

export const VISION_OPTIONS = [
  { value: -2, label: "Muy pesimista" },
  { value: -1, label: "Pesimista" },
  { value: 0, label: "Ni pesimista ni optimista" },
  { value: 1, label: "Optimista" },
  { value: 2, label: "Muy optimista" },
] as const;
