# Cannapa ERP v4.1 — Operación Inteligente

Nueva versión integral posterior a la auditoría visual y funcional completa.

## Incluye
- Limpieza automática de registros duplicados funcionales.
- Contexto superior dinámico según cada módulo.
- Navegación lateral plegable y buscador global.
- Dashboard gerencial con prioridades, producción y costos.
- Formularios compactos.
- Naves sin selector confuso de distribución.
- Validaciones de nombres y códigos únicos.
- Inteligencia sin alertas falsas por datos en cero.
- Auditoría con ubicaciones legibles.
- Base preparada para fortalecer trazabilidad, Supabase y roles.

## Verificación
```bash
npm install
npm run audit:static
npm run build
```


## Corrección v4.1
- Eliminada la barra superior global de contexto.
- Cada pantalla usa solamente sus propios filtros.
- Croquis operativo respeta filas y plantas por fila.
- Mapa de plantas muestra todas las posiciones, sin recortes.
- Croquis de sede ya no limita la visualización a 60 plantas.
- Todas las plantas se dibujan en su fila y posición exactas.
