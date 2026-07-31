# Actualización a Cannapa ERP v4.0

1. Haz primero un respaldo JSON desde Configuración.
2. Reemplaza los archivos del proyecto por los de esta carpeta.
3. En Codespaces ejecuta, por separado:

npm install

npm run audit:static

npm run build

4. Cuando aparezca `✓ built`, prueba:
- Dashboard
- Naves y camas
- Plantas madre
- Propagación
- Croquis
- MIRFE y MIPE
- Flujo productivo
- Inventario
- Inteligencia
- Diagnóstico

5. Publica:

git add .

git commit -m "Cannapa ERP v4.0 Operacion Inteligente"

git push
