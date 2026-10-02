# Snapshot del sitio estático anterior

Este directorio conserva la versión HTML/CSS/JavaScript y Google Apps Script
previa a Next.js. No forma parte del runtime de la aplicación nueva y no debe
configurarse como raíz del deployment de Vercel.

Incluye el código Apps Script y las instrucciones como respaldo. No borra ni
modifica Google Sheets, Drive ni la implementación de Apps Script. El CSV
conservado en este snapshot es sintético.

Para revisar visualmente esta copia, servir este directorio como raíz de un
servidor estático local; no volver a publicar el snapshot sobre el dominio
principal una vez que se realice el corte a Vercel.
