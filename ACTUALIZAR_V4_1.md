# Actualizar a Cannapa ERP v4.1

1. Descarga un respaldo JSON desde Configuración.
2. Reemplaza los archivos del proyecto.
3. Ejecuta por separado:

npm install

npm run audit:static

npm run build

4. Revisa especialmente:
- Croquis operativo
- Croquis de sede
- Mapa de plantas
- Nave con 50, 90 o más plantas por cama
- Cama con varias filas

5. Publica:

git add .

git commit -m "Cannapa ERP v4.1 Croquis completos"

git push
