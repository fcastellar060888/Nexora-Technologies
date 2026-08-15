# Despliegue de Nexora One

## Plataforma objetivo

Nexora One se compila con Vite y se publica como sitio estático en Cloudflare Pages. El despliegue debe reproducir el contrato validado por el workflow `Quality`; no se considera certificado un build generado con dependencias, variables o comandos distintos.

## Rama de producción

- Producción estable: `main`
- Desarrollo y validación activa: `foundation/event-bus-core`
- Auditorías o ramas de trabajo: Preview Deployment únicamente

Los cambios solo deben pasar a producción después de superar `Quality`, la reauditoría aplicable y la integración controlada a `main`.

## Configuración de Cloudflare Pages

- Framework preset: `Vite`
- Build command: `npm run build:production`
- Build output directory: `dist`
- Node.js: `24` para mantener paridad con CI
- Root directory: `/`
- Production branch: `main`
- Preview branches: habilitadas

El repositorio declara compatibilidad mínima con Node `>=20.19.0`, pero el pipeline certificado usa Node 24. Cloudflare debe fijar la misma versión para evitar diferencias entre CI y producción.

## Variables públicas obligatorias

Los perfiles `preview`, `staging` y `production` requieren las variables declaradas en `config/environments.json`:

- `VITE_APP_ENV`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Valores de `VITE_APP_ENV` por entorno:

- Preview: `preview`
- Staging: `staging`
- Producción: `production`

`VITE_SUPABASE_URL` debe apuntar al proyecto Supabase autorizado para el entorno y `VITE_SUPABASE_ANON_KEY` debe ser exclusivamente la clave pública `anon`. Nunca deben exponerse como variables `VITE_*` credenciales privilegiadas como `SERVICE_ROLE`, claves privadas, contraseñas de base de datos o secretos equivalentes; `audit:env` bloquea nombres de ese tipo.

## Instalación reproducible

La única instalación aceptada para CI y certificación de despliegue es la basada en el lockfile:

```bash
npm ci --no-fund
```

No usar `npm install` para certificar un release, porque puede resolver un árbol diferente al registrado en `package-lock.json`.

## Certificación previa al despliegue

Desde un checkout limpio del commit candidato:

```bash
npm ci --no-fund
npm run check
```

`npm run check` ejecuta, en orden:

1. auditoría estática;
2. auditoría de dependencias con bloqueo de vulnerabilidades `high` o superiores;
3. contrato de variables de entorno;
4. auditoría de autenticación y sesión;
5. suite funcional con cobertura y umbrales obligatorios;
6. build Vite en modo `production`;
7. auditoría del artefacto de producción.

El workflow `.github/workflows/quality.yml` ejecuta además la suite funcional normal antes del gate de cobertura y conserva evidencia TAP. Un commit con cualquier gate fallido no es desplegable.

## Supabase y migraciones

Antes de promover una versión que incluya migraciones nuevas, el esquema correspondiente debe estar aplicado en el proyecto Supabase del entorno objetivo. El cliente no debe utilizar credenciales administrativas para compensar una migración ausente.

Las políticas RLS, funciones RPC y restricciones definidas por las migraciones forman parte del contrato de producción y deben tratarse como código versionado.

## Enlaces públicos

El dominio de producción y el dominio de preview deben registrarse aquí cuando Cloudflare Pages los confirme:

- Producción: pendiente de confirmar
- Preview de `foundation/event-bus-core`: pendiente de confirmar

## Navegación SPA

Nexora usa React Router. Cloudflare Pages debe devolver `index.html` para rutas de aplicación como:

- `/mipe/dashboard`
- `/material-plant/:plantId`
- `/plant/:plantId`

Si una ruta directa devuelve 404, se debe configurar el fallback SPA mediante `_redirects` en `public/`.
