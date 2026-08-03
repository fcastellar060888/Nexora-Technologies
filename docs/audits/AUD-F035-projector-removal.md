# AUD-F035 — Retirada segura de proyectores

## Estado
Cerrado y certificado.

## Riesgo
`unregisterProjector()` podía retirar un proyector requerido por otros componentes y dejar dependencias registradas apuntando a un identificador inexistente.

## Garantía certificada
- La retirada valida primero todos los dependientes directos activos.
- Si existe al menos uno, la operación falla antes de modificar el registro.
- Los dependientes se reportan ordenados de forma determinista.
- Una cadena solo puede desmontarse desde las hojas hacia la raíz.
- Una retirada rechazada conserva proyectores, métricas, historial, secuencia, marcas procesadas y checkpoints persistentes.
- La fachada persistente hereda exactamente la misma protección.

## Evidencia
- Protección productiva en `src/core/projectionEngine/projectionEngine.js`.
- Pruebas base en `tests/projection-engine.test.mjs`.
- Suite adversarial en `tests/aud-f035-projector-removal.test.mjs`.
- Quality técnico: workflow #1016, success.

## Reauditoría
No se identificó otra API de retirada ni un registro paralelo de proyectores. La única ruta pública delega al motor canónico y mantiene consistente la firma utilizada por checkpoints.
