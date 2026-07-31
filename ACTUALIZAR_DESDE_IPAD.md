# Actualizar a Cannapa ERP v2.2

1. Reemplaza el contenido interno de `src`.
2. Reemplaza `package.json`, `README.md`, `PRUEBA_PILOTO.md`, `scripts` y `supabase/schema.sql`.
3. Ejecuta:
   npm install
4. Ejecuta:
   npm run audit:static
5. Ejecuta:
   npm run build
6. Si ambos terminan correctamente:
   git add .
   git commit -m "Cannapa ERP v2.2 Candidata a Piloto"
   git push
