# Cierre forense AUD-F017

## Hallazgo

**Área:** Identidad vegetal  
**Severidad:** Alta  
**Riesgo original:** las plantas abuela y madre se proyectaban virtualmente desde `lote + índice`. Cambiar `quantity`, reordenar datos o persistir un override parcial podía eliminar, recrear o sustituir una vida individual manteniendo aparentemente la misma posición.

## Corrección aplicada

1. Se creó una colección persistente `materialPlantUnits` como autoridad para cada vida individual.
2. Los lotes históricos se materializan con identificadores determinísticos compatibles.
3. Se añadió `materialPlantIdentityRegistry` para sellar la población inicial por lote y distinguir la migración histórica de cambios posteriores en `quantity`.
4. Una disminución de cantidad no elimina vidas; una ampliación posterior no inventa vidas nuevas.
5. Las colecciones históricas parciales se completan atómicamente antes de sellar el lote, preservando IDs externos, estados y retiros existentes.
6. La carga y el guardado local ejecutan la misma migración de identidad.
7. El bootstrap autoritativo materializa las entidades antes de entregar el estado al Store.
8. `upsertMaterialPlantUnit()` rechaza la sustitución de un ID por otro en la misma posición y las colisiones entre ID y posición canónica.
9. Passport, propagación, mapas y acciones conservan compatibilidad con datos históricos sin volver a depender de `quantity + index` como identidad viva.

## Pruebas adversariales

- Materialización única de lotes históricos.
- Conservación de identidad después de reducir la cantidad del lote.
- Ausencia de creación automática después de ampliar un lote sellado.
- Conservación de una vida retirada sin sustitución.
- Reconciliación de colecciones parciales antes del sellado.
- Conservación de identificadores externos.
- Rechazo de IDs duplicados.
- Rechazo de sustitución de identidad mediante `upsert`.
- Rechazo de colisión entre ID y posición.
- Materialización durante bootstrap remoto.
- Conservación de vidas remotas existentes y creación exclusiva de faltantes históricos.

## Evidencia de commits

- `528d955e92f0217f1033d13f4cf0f5a2b6e58898` — materialización inicial de entidades.
- `1b6d9c8c8e6f622747a07ac597695d5cdfed9b51` — servicio de persistencia.
- `f201a9f5ed89a411c47992356deca269e72d3e88` — integración con caché local.
- `631491710e5946280c94b6e07fdd2d255ec1bb80` — compatibilidad con consumidores históricos.
- `4dfafeec89aebe0bcb124d77f792a0517f52d011` — registro de materialización por lote.
- `86391379a0466ea73beb2ef679a5d343a5037406` — prueba de reconciliación parcial.
- `aece8d89bf5beb78b02cb4b870cef8f301d4b489` — protección de identidad en acciones.
- `2a31f055751e01296e84ac0b8023ca6b057f72f5` — pruebas de colisión y sustitución.
- `01447113b56c51e155cc20ff615ed46d93f858dc` — materialización durante bootstrap.
- `1a67be4fac2eecc963863009331e4ba93045ae6a` — pruebas finales de bootstrap.

## Quality

- `#676`: detectó incompatibilidades de Passport y propagación.
- `#678`: verde después de compatibilidad histórica.
- `#684`: detectó expectativa obsoleta de población parcial.
- `#690`: verde después de protección de identidad en `upsert`.
- `#694`: verde sobre el cierre técnico final, incluyendo bootstrap remoto.

## Reauditoría independiente

La reauditoría detectó y corrigió dos condiciones residuales:

1. Un override individual creado antes de la migración completa podía dejar las demás vidas del lote sin materializar.
2. El bootstrap remoto podía entregar un estado virtual al Store y materializarlo únicamente al guardarlo, sin actualizar el estado en memoria.

Ambas rutas quedaron cerradas mediante reconciliación parcial con registro por lote y materialización previa a la hidratación del Store.

## Resultado

**AUD-F017: CERRADO Y CERTIFICADO.**

La existencia y la identidad de una planta individual ya no dependen de la cantidad actual, del orden del lote ni de un índice recalculado. Cada vida materializada conserva identidad, estado y trazabilidad propios durante todo su ciclo.