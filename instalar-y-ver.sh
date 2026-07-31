#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "Instalando Cannapa ERP Enterprise v6.1..."
rm -rf node_modules dist
npm install
npm run build
echo "Iniciando Vite en el puerto 5173..."
(npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/cannapa-vite.log 2>&1 & echo $! > /tmp/cannapa-vite.pid)
sleep 3
if command -v cloudflared >/dev/null 2>&1; then
  echo "Creando enlace Cloudflare..."
  cloudflared tunnel --url http://localhost:5173
else
  echo "Cloudflared no está instalado. Abre el puerto 5173 desde la pestaña PORTS de Codespaces."
  tail -n 20 /tmp/cannapa-vite.log
fi
