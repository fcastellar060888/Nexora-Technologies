# Cannapa ERP Enterprise V6.0

## Reglas estructurales
- Solo se crean lotes de abuelas, madres y esquejes.
- El lote productivo nace al cortar esquejes y mantiene el mismo código hasta inventario y venta.
- No existe módulo de lotes biológicos ni creación de lotes por fase.
- Abuelas y madres no usan nombre; se identifican por lote.
- Producto terminado se controla por lote y clasificación.
- Las ventas permiten precio por gramo, moneda y tasa histórica congelada.
- El mapa único por sede utiliza los lotes productivos reales.

## Verificación
```bash
npm install
npm run audit:static
npm run build
```
