# AUD-F035 — Retiro seguro de proyectores dependidos

## Estado

Cerrado y certificado.

## Riesgo original

`unregisterProjector(projectorId)` eliminaba directamente el proyector del registro. Si otro proyector lo declaraba en `dependencies`, el motor quedaba con referencias huérfanas y el defecto aparecía tardíamente al listar o ejecutar el grafo.

## Corrección

La operación de retiro ahora:

1. Normaliza y comprueba la identidad solicitada.
2. Devuelve `false` cuando el proyector no existe.
3. Calcula todos los dependientes directos activos.
4. Rechaza la retirada con una lista determinista de dependientes cuando exista al menos uno.
5. Conserva el registro sin cambios ante el rechazo.
6. Solo elimina proyectores hoja, permitiendo desmontar el grafo en orden inverso de dependencias.

## Invariantes certificadas

- No puede quedar una dependencia apuntando a un proyector inexistente.
- Un retiro rechazado es atómico y no cambia la firma del registro.
- La fachada persistente hereda exactamente el mismo contrato protegido.
- Los checkpoints continúan ligados al conjunto real `projectorId@version` después de una retirada válida.
- Retirar un identificador inexistente es idempotente y devuelve `false`.

## Pruebas adversariales

- Intento de retirar una dependencia raíz requerida por una cadena de proyectores.
- Verificación de preservación exacta del registro después del rechazo.
- Retiro válido en orden hoja → dependencia → raíz.
- Verificación de ausencia de referencias huérfanas tras desmontaje completo.

## Evidencia

- Corrección: `b43d1fa2bacabbf4c8947d3c44d22507eb54179c`
- Pruebas: `9ffc4646328541ded72169b7d4d9b1a05368b1f9`
- Quality técnico: ejecución `#1002`, success.

## Reauditoría

No se encontró otra ruta productiva de retiro. `createPersistentProjectionEngine()` expone el método protegido del motor base mediante su fachada inmutable. La firma de checkpoints se calcula desde `listProjectors()`, por lo que solo cambia después de una retirada válida y nunca tras una operación rechazada.
