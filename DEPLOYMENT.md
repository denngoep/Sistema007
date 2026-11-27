# Despliegue de Sistema 007

## Variables obligatorias

Configure el backend a partir de `backend/.env.example`, sin publicar el
archivo `.env`. Como mínimo defina `NODE_ENV=production`, `PORT`,
`DATABASE_URL`, `DATABASE_NAME`, `JWT_SECRET`, `FRONTEND_URL` e
`INVENTORY_DOCUMENTS_ENABLED=true`.

`JWT_SECRET` debe ser aleatorio, exclusivo del entorno y tener al menos 32
bytes. No reutilice la clave local. `FRONTEND_URL` admite una lista separada
por comas cuando haya más de un origen autorizado por CORS.

Defina `INVENTORY_DOCUMENT_ROOT` como una ruta persistente, privada y fuera
del directorio público del frontend. El proceso del backend debe tener lectura
y escritura en esa ruta; el servidor web no debe exponerla directamente.

Para el frontend copie `fronted/.env.example` a la configuración del entorno y
asigne `VITE_API_URL` a la URL pública HTTPS del backend, sin barra final.
Las variables Vite se incorporan durante el build, por lo que se debe
recompilar el frontend cuando cambien.

Configure también las credenciales reales de SMTP, Google y reCAPTCHA solo en
el proveedor de secretos del entorno de despliegue. Los valores `replace-me`
son marcadores y no son utilizables.

## Construcción y migraciones

1. Genere un respaldo verificable de MySQL antes de cada despliegue.
2. Instale dependencias bloqueadas (`npm ci`) en `backend` y `fronted`.
3. En `backend`, ejecute `npx prisma migrate deploy` y `npx prisma generate`.
4. Ejecute `npm run build` en `backend` y `fronted`.
5. Inicie el backend con `npm run start:prod` y sirva el contenido de
   `fronted/dist` con un servidor que entregue `index.html` para rutas no
   estáticas (fallback de SPA).

No use `prisma migrate reset`, `prisma db push`, ni los lanzadores locales
`npm run dev` / `npm run dev:test` en producción. El acceso integral de
pruebas depende de la base aislada y no debe habilitarse en producción.

## Verificación posterior

- Confirme que CORS acepta solo el origen publicado.
- Compruebe inicio de sesión, carga autenticada de un documento en un entorno
  con datos ficticios y su descarga autorizada.
- Confirme que la ruta privada de documentos no sea pública.
- Revise el estado Prisma con `npx prisma migrate status`.
