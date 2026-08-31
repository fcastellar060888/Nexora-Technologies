# Nexora One — Cloudflare

Este archivo se conserva únicamente como punto de entrada para enlaces históricos.

La guía canónica de despliegue, promoción, variables y rollback está en:

- `docs/operations/CLOUDFLARE_DEPLOYMENT_RUNBOOK.md`
- `config/deployment-policy.json`
- `config/environments.json`

No uses las instrucciones antiguas de túnel temporal como procedimiento de despliegue de preview, staging o producción. Tampoco uses `npm install` para reproducir el entorno certificado: el flujo de Quality y despliegue parte del lockfile y de `npm ci`.

Cualquier promoción a producción requiere Quality exitoso sobre el commit objetivo y aprobación humana explícita. Un rollback debe restaurar un deployment previo e inmutable de Cloudflare Pages para el mismo entorno; no debe reescribir `main` ni el historial Git.
