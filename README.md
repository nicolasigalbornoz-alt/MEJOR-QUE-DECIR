# MEJOR QUE DECIR

Plataforma de escucha y gestión de eventos, formularios y reportes de Jóvenes FR.
La aplicación nueva usa Next.js y Supabase; el sitio estático anterior se
conserva como referencia en `legacy/static-site/` durante la transición.

## Stack

- **Next.js App Router, React y TypeScript** para las rutas públicas y el panel.
- **Supabase PostgreSQL, Auth y Storage** para datos, acceso administrativo y actas.
- **`@supabase/ssr`** para sesiones seguras en servidor.
- **Zod** para validar respuestas y operaciones.
- **Leaflet** para el mapa federal, sin tiles externos ni claves de mapas.
- **Vercel** como deployment previsto; el dominio se cambia solo al completar
  y probar el corte.

Se conserva el CSS, tipografía, logo, GeoJSON y diseño móvil del sitio anterior.
No se añade una biblioteca visual ni infraestructura distribuida.

## Funcionalidades

- Portada e información de eventos publicados.
- Formulario de escucha con tipos de preguntas acotados y respuestas versionadas.
- Mapa federal con provincias, CABA, Malvinas y Antártida, búsqueda y datos por distrito.
- Síntesis con agregados, comisiones, conclusiones, actas y salida para imprimir.
- Insumos enlazados a Drive y Centros de Estudios.
- Panel autenticado para una única cuenta administradora: gestión de eventos,
  formularios, versiones, cupos y actas.
- Los resúmenes de actas son públicos. Cada documento Word se guarda privado;
  el administrador puede habilitar o quitar su publicación individualmente.

## Ejecutar localmente

Requiere Node.js 20.9 o superior.

```bash
npm install
npm run dev
```

La portada, el mapa y la síntesis usan el CSV **sintético** de
`public/data/respuestas-demo.csv` cuando no hay respuestas reales en Supabase.
La interfaz lo identifica como demostración; no se mezcla con respuestas reales
ni se importa automáticamente a la base.

Para probar autenticación, formularios, operaciones administrativas y Storage,
configurá `.env.local` a partir de `.env.example` y aplicá las migraciones. Los
pasos están en [`supabase/README.md`](supabase/README.md). No compartas claves
privadas en el repositorio ni en el chat.

Comprobaciones disponibles:

```bash
npm run lint
npm run typecheck
npm run build
```

## Estructura

```text
src/
  app/                    Rutas públicas, APIs y panel autenticado
  components/             Interfaz compartida
  data/                   Catálogo provincial y contenido editorial
  features/
    events/               Eventos y materiales de Drive
    forms/                Formularios y renderer
    reports/              Mapa, agregados y síntesis
  lib/
    auth/                 Comprobación server-side de administrador
    data/                 Consultas Supabase y datos de demostración
    supabase/             Clientes server y público
    validation/           Validación de envíos
  styles/                 Sistema visual preservado
public/
  assets/                 Logo, fuentes, Leaflet y GeoJSON
  data/                   CSV sintético de demostración
supabase/
  migrations/             Esquema, funciones, Storage y políticas RLS
  seed.sql                Evento, formulario inicial y catálogos
legacy/
  static-site/            Snapshot HTML/CSS/JS y backend Apps Script anterior
```

## Datos y privacidad

- Las migraciones SQL de `supabase/migrations/` versionan el esquema, las
  políticas RLS y los bucket/policies de Storage.
- Las respuestas crudas y el padrón no se exponen en rutas públicas. El mapa y
  la síntesis consumen un agregado SQL limitado a campos de publicación.
- Si todavía no hay respuestas reales, se usa el fixture CSV de demostración.
  Las respuestas de demostración no entran en los conteos de cupos.
- El directorio de autocompletado está vacío hasta que se importe el padrón
  mínimo (nombre, provincia y localidad). La encuesta permite completar esos
  campos manualmente mientras tanto.
- Los documentos de actas viven en un bucket privado. Los enlaces públicos se
  firman por tiempo limitado y solo se crean cuando su opción individual está
  habilitada.
- Las exportaciones de respuestas reales no se han realizado ni importado.

## Deployment

El destino de la aplicación full stack es Vercel. Configurar allí
`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, además de
los redirect URLs de Supabase Auth para producción y preview.

El dominio `mejorquedecir.com` no se cambió desde este repositorio. Antes de
apuntarlo a Vercel, verificar la aplicación desplegada, el proyecto Supabase,
las rutas, las políticas y los archivos. Los redirects conservan las antiguas
URLs `.html` después del corte.

**El repositorio ya no se publica como sitio estático desde la raíz de GitHub
Pages:** sus páginas están archivadas en `legacy/static-site/`. Antes de
publicar estos cambios, conectar la raíz del repositorio a Vercel y verificar
allí la aplicación. El DNS y el dominio no se modifican automáticamente por
este proyecto.

## Sitio anterior

`legacy/static-site/` es una copia archivada para recuperación; no es parte del
runtime de Next.js. El backend de Apps Script y las hojas/archivos de Google no
se borran desde este proyecto. No retirar esos servicios hasta confirmar que
no reciben tráfico ni son necesarios como respaldo.

---

_MEJOR QUE DECIR — Jóvenes FR_
