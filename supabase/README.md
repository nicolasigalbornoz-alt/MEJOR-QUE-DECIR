# Supabase: configuración y datos

El panel tiene tres roles: **admin** (todo, incluido borrar y gestionar
usuarios), **editor** (carga y edita) y **lector** (solo consulta). El
registro público está deshabilitado: las cuentas se crean por invitación desde
`/admin/usuarios`. El padrón, las respuestas y las bases internas no se
publican como tablas.

## Aplicar esquema y catálogo inicial

La CLI de Supabase no forma parte de las dependencias del proyecto. Para
configuración inicial, usar **Supabase Dashboard → SQL Editor**:

1. En un proyecto nuevo, ejecutar en orden:
   - `migrations/20261001000000_create_admin_access.sql`
   - `migrations/20261002000000_create_events_forms_and_reports.sql`
   - `migrations/20261020000000_legacy_import_support.sql`
   - `migrations/20261021000000_staff_roles.sql`
   - `migrations/20261022000000_tags_and_militants.sql`
   - `migrations/20261023000000_contacts.sql`
   - `migrations/20261024000000_activities.sql`
   - `migrations/20261025000000_library.sql`
2. Ejecutar `seed.sql` para crear el evento inicial, el formulario publicado,
   las preguntas y los catálogos de provincias, comisiones y talleres.
3. No habilitar auto-registro. Crear la primera cuenta administradora en
   **Authentication → Users** y darle el rol (las siguientes se invitan desde
   el panel):

   ```sql
   insert into public.staff_members (user_id, role, email)
   values ('UUID_DEL_USUARIO', 'admin', 'correo@ejemplo.com')
   on conflict (user_id) do update set role = 'admin';
   ```

   En un proyecto que ya tenía `admin_users`, la migración de roles copia esas
   cuentas como admin y después elimina la tabla.

Si la primera migración ya está aplicada y tu acceso actual funciona, **no la
vuelvas a ejecutar**: aplicá solamente las que falten y luego `seed.sql`.

La cuenta de Auth y la fila de `staff_members` son controles separados. La
autenticación confirma quién sos; el rol y RLS determinan qué podés hacer.
Siempre tiene que quedar al menos un admin (lo impide un trigger).

## Invitaciones

1. Configurar `SUPABASE_SERVICE_ROLE_KEY` en `.env.local` y en Vercel (solo
   servidor, nunca `NEXT_PUBLIC_*`). Se usa únicamente para invitar y eliminar
   cuentas, después de comprobar que quien lo pide es admin.
2. En **Authentication → Email Templates → Invite user**, el enlace tiene que
   apuntar a la ruta de confirmación del panel:

   ```html
   <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=invite">Aceptar invitación</a>
   ```

3. En **Authentication → URL Configuration**, agregar como redirect URLs
   `http://localhost:3000/admin/auth/confirm` y la misma ruta del dominio de
   producción.

La persona invitada abre el mail, elige su contraseña en `/admin/clave` y
entra con el rol asignado.

## Variables locales y Vercel

Completar `.env.local` a partir de `.env.example` con:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Las mismas variables públicas se configuran en Vercel para los entornos
Production y Preview. Configurá también en Supabase Auth el Site URL y los
redirect URLs correspondientes a `http://localhost:3000` y al dominio de
producción.

Salvo las invitaciones, la aplicación no usa `service_role`: las páginas
usan la sesión de cada usuario, consultas públicas acotadas y funciones SQL con
permisos específicos. Nunca agregues una clave privilegiada a `NEXT_PUBLIC_*`.

## Archivos del panel

- `activity-files` (insumos: PDF, Word e imágenes hasta 20 MB) y `library`
  (formación: PDF y EPUB hasta 50 MB) son buckets privados. Leen todos los
  roles; suben y quitan archivos editores y admins.
- Las descargas pasan por `/admin/descargas/...`, que comprueba la sesión y
  redirige a una URL firmada de 5 minutos.
- Un archivo subido en un formulario que no se guarda queda sin referencia en
  el bucket; se puede limpiar desde el dashboard de Storage.

## Datos de respuesta y padrón

- Las respuestas y el padrón de la planilla anterior se importan una sola vez
  con `node scripts/import-legacy-sheet.mjs` (Node 22.18+). El script lee las
  pestañas "Respuestas encuesta" y "acred" y genera
  `migration-input/import-legacy.sql`, que se pega en el SQL Editor después de
  las migraciones y `seed.sql`. Es idempotente. `migration-input/` está
  ignorado por git porque contiene datos personales.
- Del padrón solo se importan nombre, provincia, localidad y acreditación. La
  asignación final de comisión y panel queda en `submission_assignments`.
- El mismo script genera `migration-input/import-militants.sql`, que carga la
  base de compañeros del panel (nombre, provincia, localidad, teléfono y mail)
  con la etiqueta "Militante". Se ejecuta después de la migración de
  compañeros y no duplica personas si se repite.
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
