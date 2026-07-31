# Cannapa ERP Enterprise v6.1 — instalación limpia

Desde la carpeta del proyecto:

```bash
rm -rf node_modules dist
npm install
npm run build
npm run dev -- --host 0.0.0.0 --port 5173
```

En otra terminal, publica el puerto con Cloudflare:

```bash
cloudflared tunnel --url http://localhost:5173
```

Abre la dirección `https://...trycloudflare.com` que imprime Cloudflare.

## Importante
La aplicación usa almacenamiento local del navegador. Para comenzar completamente limpio, borra los datos del sitio del dominio anterior o abre el nuevo enlace en una ventana privada. Los respaldos JSON de v6 siguen siendo compatibles; la migración agrega automáticamente las nuevas colecciones de áreas e infraestructura.
