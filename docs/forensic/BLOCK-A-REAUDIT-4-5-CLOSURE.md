# Cierre forense — Reauditorías 4 y 5 del Bloque A

## Alcance

Revisión independiente del flujo Event Bus → Ledger → Store → bootstrap remoto → sincronización → persistencia local.

## Hallazgos incorporados

### AUD-F069 — Limpieza insegura del Event Bus durante publicaciones activas

`clear()` podía eliminar `inFlight` mientras una entrega continuaba, habilitando una segunda ejecución del mismo evento y permitiendo que la primera repoblara el estado después de la limpieza.

**Corrección:** `clear()` rechaza ejecutarse mientras existan publicaciones activas. La limpieza solo se permite después de concluir todas las entregas.

### AUD-F070 — Huella de identidad no canónica

La identidad usaba `JSON.stringify()`, por lo que dependía del orden de propiedades y no soportaba correctamente valores estructurados o especiales admitidos por el contrato de eventos.

**Corrección:** serialización canónica con orden estable de propiedades, distinción de tipos, soporte de valores especiales y referencias estructurales.

### AUD-F071 — Duplicado en vuelo comunicado como completado

Una publicación que llegaba mientras un handler estaba activo podía recibir `duplicate: true` junto con `pending: false`, aunque la entrega original todavía no había concluido.

**Corrección:** todo duplicado reentrante o tardío en vuelo informa `inFlight: true` y `pending: true`; nunca comunica finalización antes de conocer el resultado de la entrega original.

## Evidencia

- Implementación lifecycle e identidad: `c05dd033aca43301782d1b77fb94e02153ce56c2`
- Pruebas de reauditoría 4: `c92ae682238c27788db5ae716faa1325deaa1ae8`
- Ajuste contractual de prueba: `5ee9a0eb2d193c832260d2fc5bf8d4a97bae7b0b`
- Estado pendiente para duplicados en vuelo: `843a78662d8616348b013ae1033e5b5b4d177ce6`
- Prueba explícita de pending: `639f9dff423ffefb6834085b439eac4c29b3d633`
- Quality de correcciones: `#604` — success
- Reauditoría independiente final: `23417e6bcbae564baaa6c5ac10502c765328477c`
- Quality de reauditoría final: `#606` — success

## Dictamen

La Reauditoría 4 encontró tres defectos reales, todos corregidos y certificados. La Reauditoría 5 se ejecutó sobre el estado corregido y no encontró hallazgos adicionales. El Bloque A recupera su certificación y queda autorizado el inicio del Bloque B.
