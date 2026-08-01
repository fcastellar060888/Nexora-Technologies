# Despliegue de Nexora One

## Plataforma objetivo

La aplicación web se compila con Vite y debe publicarse como sitio estático en Cloudflare Pages.

## Rama de producción

- Producción estable: `main`
- Desarrollo y validación activa: `foundation/event-bus-core`

La rama de desarrollo debe usar un Preview Deployment de Cloudflare Pages. Los cambios solo deben pasar a producción después de superar el workflow `Quality` y ser integrados a `main`.

## Configuración de Cloudflare Pages

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js: `20.19.0` o superior compatible
- Root directory: `/`
- Production branch: `main`
- Preview branches: habilitadas

## Variables recomendadas

- `NODE_VERSION=20.19.0`

Las variables funcionales o credenciales futuras deben configurarse en Cloudflare y nunca guardarse en el repositorio.

## Enlaces públicos

El dominio de producción y el dominio de preview deben registrarse aquí cuando Cloudflare Pages los confirme:

- Producción: pendiente de confirmar
- Preview de `foundation/event-bus-core`: pendiente de confirmar

## Certificación previa al despliegue

```bash
npm install --no-audit --no-fund
npm run check
```

El comando valida auditoría estática, pruebas automatizadas y build de producción.

## Navegación SPA

Nexora usa React Router. Cloudflare Pages debe devolver `index.html` para rutas de aplicación como:

- `/mipe/dashboard`
- `/material-plant/:plantId`
- `/plant/:plantId`

Si una ruta directa devuelve 404, se debe configurar el fallback SPA mediante `_redirects` en `public/`.
