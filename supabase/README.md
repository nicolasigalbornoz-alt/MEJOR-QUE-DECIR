# Supabase: configuración y datos

La aplicación usa una sola cuenta administradora. El registro público está
deshabilitado; el padrón y las respuestas no se publican como tablas.

## Aplicar esquema y catálogo inicial

La CLI de Supabase no forma parte de las dependencias del proyecto. Para
configuración inicial, usar **Supabase Dashboard → SQL Editor**:

1. En un proyecto nuevo, ejecutar en orden:
   - `migrations/20261001000000_create_admin_access.sql`
   - `migrations/20261002000000_create_events_forms_and_reports.sql`
2. Ejecutar `seed.sql` para crear el evento inicial, el formulario publicado,
   las preguntas y los catálogos de provincias, comisiones y talleres.
3. No habilitar auto-registro. Crear el usuario administrador en
   **Authentication → Users** y darle acceso en `public.admin_users` si aún no
   está asignado:

   ```sql
   insert into public.admin_users (user_id)
   values ('UUID_DEL_USUARIO')
   on conflict (user_id) do nothing;
   ```

Si la primera migración ya está aplicada y tu acceso actual funciona, **no la
vuelvas a ejecutar**: aplica solamente la segunda y luego `seed.sql`.

La cuenta de Auth y la fila de `admin_users` son controles separados. La
autenticación confirma quién sos; la allowlist y RLS determinan si podés
administrar.

## Variables locales y Vercel

Completar `.env.local` a partir de `.env.example` con:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Las mismas variables públicas se configuran en Vercel para los entornos
Production y Preview. Configurá también en Supabase Auth el Site URL y los
redirect URLs correspondientes a `http://localhost:3000` y al dominio de
producción.

La aplicación no requiere `service_role`: las páginas usan sesiones del
administrador, consultas públicas acotadas y funciones SQL con permisos
específicos. Nunca agregues una clave privilegiada a `NEXT_PUBLIC_*`.

## Datos de respuesta y padrón

- No se importaron respuestas reales desde Sheets.
- `public/data/respuestas-demo.csv` es sintético y se usa como fallback visual
  cuando la función de reportes no tiene respuestas reales. No se inserta en
  `form_submissions` ni se mezcla con datos reales.
- Las respuestas futuras se guardan asociadas a la versión publicada del
  formulario. La función SQL valida tipos, opciones, escalas y duplicados.
- `attendee_directory` está vacío mientras no se importe el padrón mínimo.
  El endpoint de autocompletado solo devuelve hasta ocho coincidencias con
  nombre, provincia y localidad; el formulario permite ingresarlos a mano.
  No importar teléfono, correo, fecha de nacimiento ni redes sociales.

## Actas de comisión

El bucket `commission-acts` es privado. El resumen de cada acta se publica en
la síntesis; el administrador puede habilitar o deshabilitar la publicación
del documento Word individualmente. Los enlaces a documentos públicos son
firmados y expiran después de una hora. Al volver un documento privado, no se
emiten nuevos enlaces públicos.

Los originales que ya estén en Drive no se borran ni se copian durante esta
migración; quedan como respaldo fuera de la base nueva.
