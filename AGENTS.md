# Guía de arquitectura y trabajo

## Contexto del proyecto

MEJOR QUE DECIR es una plataforma web para publicar información, gestionar
eventos, administrar formularios y consultar reportes. El stack y la estructura
están documentados en `README.md`.

El sitio HTML/CSS/JavaScript y Google Apps Script se conserva como snapshot en
`legacy/static-site/`. No usarlo como implementación nueva ni borrar hojas,
Apps Script o archivos de Drive que todavía puedan servir de respaldo.

## Stack objetivo

- Next.js App Router, React y TypeScript.
- Supabase PostgreSQL, Auth y Storage.
- `@supabase/ssr` para sesiones de Supabase en el servidor de Next.js.
- Zod para validación. Incorporar React Hook Form solo si la complejidad real
  de los formularios lo justifica.
- Leaflet para el mapa existente.
- Vercel es el deployment recomendado por simplicidad inicial; mantener el
  código compatible con los límites normales de Next.js y no acoplar la
  lógica de negocio al proveedor de hosting.

No cambiar de tecnología solo porque exista una alternativa más reciente.
No añadir Tailwind, una biblioteca visual, CMS, colas, microservicios ni
infraestructura distribuida sin una necesidad confirmada.

## Principios de arquitectura

1. **Aplicación modular, no microservicios.** Mantener un único proyecto
   Next.js organizado por áreas funcionales: eventos, formularios, reportes
   y administración. El panel tiene tres roles confirmados (admin, editor y
   lector, en `staff_members`); no agregar roles ni permisos por sección sin
   un requisito confirmado.
2. **Separar interfaz y acceso a datos.** Componentes de UI no contienen
   consultas SQL ni decisiones de permisos. Mantener el acceso a datos en
   módulos exclusivamente de servidor.
3. **Lógica privada en servidor.** Usar Server Actions para mutaciones
   propias de formularios de la aplicación y Route Handlers para APIs
   públicas, integraciones y webhooks. Verificar identidad y permisos en
   cada operación.
4. **RLS como defensa en profundidad.** Activar políticas de Row Level
   Security en tablas y Storage. No depender únicamente de ocultar botones o
   proteger páginas.
5. **Esquema con migraciones.** Todo cambio de PostgreSQL, RLS o Storage que
   sea parte de la aplicación debe quedar versionado en `supabase/migrations/`.
6. **Validación confiable.** Validar datos en el servidor con esquemas
   compartidos cuando sea práctico. La validación del navegador mejora la
   experiencia, pero nunca reemplaza la validación del servidor.
7. **Versionar formularios.** Las respuestas deben referirse a la versión
   concreta del formulario y a sus preguntas, para que cambios posteriores
   no reinterpreten datos históricos.
8. **Render público limitado.** Las páginas públicas consumen campos
   aprobados o resultados agregados. No exponer tablas completas de
   respuestas ni datos personales del padrón.
9. **Preservar el producto existente.** Mantener comportamiento, identidad
   visual, CSS, contenido, Leaflet y datos geográficos salvo que una tarea
   aprobada requiera cambiarlos.
10. **Migrar por etapas.** Mantener temporalmente Sheets/Apps Script cuando
    sea necesario; retirar una ruta anterior solo después de verificar su
    reemplazo.

## Seguridad y privacidad

- Nunca incluir claves privilegiadas de Supabase, contraseñas u otros
  secretos en el cliente, el repositorio o variables `NEXT_PUBLIC_*`.
- No guardar contraseñas de administración en `localStorage` ni
  `sessionStorage`.
- Autenticar y autorizar cada operación administrativa en servidor. La
  autenticación no implica autorización: comprobar el rol o permiso necesario
  para cada acción.
- Usar RLS para restringir tablas y objetos de Storage. Las claves con
  privilegios elevados solo pueden usarse en contexto de servidor y cuando
  sea imprescindible.
- Tratar datos de formularios, especialmente texto libre, como contenido no
  confiable. Escaparlos al renderizar y evitar inserción insegura con
  `innerHTML`.
- Limitar y validar archivos en servidor: tamaño, formato admitido, nombre y
  autorización de quien los carga. No hacerlos públicos por defecto.
- Para el padrón de participantes, usar solo los campos mínimos necesarios y
  limitar búsquedas y no añadir endpoints que permitan enumerarlo.
- Los datos de demostración deben ser sintéticos y permanecer diferenciados
  de cualquier dato real.
- Los resúmenes de actas son públicos; los documentos Word permanecen privados
  salvo que el administrador habilite su publicación individual.

## Modelo funcional de referencia

Entidades previstas: eventos; formularios; versiones, preguntas y opciones;
respuestas y valores; usuarios y roles; archivos; y vistas o consultas
agregadas para datos públicos. Mantener este modelo tan pequeño como permitan
los requisitos confirmados.

Para el primer alcance de formularios, soportar tipos concretos como texto,
selección, escalas y opciones múltiples. No implementar un motor arbitrario
de formularios, workflows genéricos o reglas condicionales avanzadas hasta
que el producto los necesite.

## Organización sugerida

```text
src/app/                    Rutas públicas, autenticación y paneles
src/components/             Componentes reutilizables
src/features/events/        Interfaz y operaciones de eventos
src/features/forms/         Formularios, versiones y respuestas
src/features/reports/       Mapa, datos agregados y síntesis
src/features/militants/     Base de compañeros y responsabilidades
src/features/contacts/      Contactos de dirigentes e instituciones
src/features/activities/    Insumos: actividades con adjuntos
src/features/library/       Formación: libros y PDFs
src/features/tags/          Categorías de etiquetas editables
src/app/admin/(panel)/      Panel con nav, permisos por rol y archivos
src/components/admin/       Selectores, adjuntos y listados del panel
src/lib/supabase/           Clientes Supabase server/client y sesión
src/lib/data/               Acceso a datos exclusivo de servidor
src/lib/validation/         Esquemas de validación
src/styles/                 Estilos y sistema visual
src/data/                   Catálogos estáticos
public/                     Imágenes, fuentes, GeoJSON y demo
supabase/migrations/        Migraciones SQL, RLS y Storage
legacy/static-site/         Snapshot anterior, no usado por Next.js
```

Esta estructura es una guía, no un requisito para crear directorios vacíos.
Crear módulos a medida que se implementen funcionalidades reales y seguir las
convenciones vigentes de Next.js.

## Criterios de implementación

- Mantener tipos explícitos para los datos de dominio y las respuestas de
  servicios externos.
- Preferir nombres y mensajes de interfaz en español, consistentes con el
  producto actual.
- Mantener la lógica geográfica, agregaciones y reglas de negocio separadas
  de la presentación.
- Añadir dependencias solo si resuelven una necesidad concreta y activa.
- Ejecutar las verificaciones disponibles después de cambios. Cuando todavía
  no haya scripts de test o build, no inventar que fueron ejecutados.
- No migrar todas las páginas de una vez si se puede mantener el
  comportamiento con una migración incremental.
