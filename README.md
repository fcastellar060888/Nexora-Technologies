# Nexora One

**Nexora One** es la plataforma empresarial de **Nexora Technologies** para gestionar operaciones agrícolas inteligentes con trazabilidad, identidad individual, eventos auditables y aislamiento por organización.

> **Estado actual:** el desarrollo y la auditoría integral continúan en la rama `foundation/event-bus-core`, mediante el PR **#26**. La rama `main` conserva la última base integrada hasta que ese trabajo sea certificado y fusionado.

## Identidad oficial

- **Empresa:** Nexora Technologies
- **Producto:** Nexora One
- **Núcleo tecnológico:** Nexora OS
- **Repositorio:** `fcastellar060888/Nexora-Technologies`

## Capacidades principales

Nexora One está diseñado para integrar en una sola plataforma:

- empresas, sedes, áreas, naves, camas, bancos y bandejas;
- identidad individual y genealogía de abuelas, madres, esquejes y plantas productivas;
- mapa operativo unificado y Passport universal por objeto;
- MIPE, tratamientos, seguimientos y sanidad vegetal;
- MIRFE, formulación, preparación, aplicación y costos;
- inventario, movimientos, lotes y trazabilidad;
- producción, cosecha, secado, manicura, empaque y ventas;
- usuarios, roles, permisos y auditoría;
- sincronización local/remota y operación multiempresa;
- sensores, analítica e integraciones futuras de inteligencia artificial.

## Arquitectura en desarrollo

El núcleo **Nexora OS** incorpora progresivamente:

- Domain Event Bus;
- Operational Ledger append-only;
- Timeline canónico;
- Projection Engine y replay auditable;
- Knowledge Graph;
- Passport universal;
- Workflow Engine;
- aislamiento por workspace y organización;
- persistencia, sincronización y compatibilidad con datos históricos.

## Auditoría y calidad

La rama activa se está sometiendo a una auditoría forense integral con la metodología:

> Auditar → probar → corregir → ejecutar Quality → reauditar → certificar.

El último bloque certificado antes de actualizar esta portada alcanzó:

- **639 de 639 pruebas exitosas**;
- auditoría estática satisfactoria;
- build de producción satisfactorio;
- saneamiento del Event Bus, Operational Ledger, Knowledge Graph y Projection Engine en los hallazgos revisados.

El expediente técnico permanente se mantiene en:

```text
docs/master/
├── PROJECT_STATUS.md
└── NEXT_SESSION.md
```

## Desarrollo local

La configuración exacta depende de la rama utilizada. En la rama activa:

```bash
npm install
npm run dev
```

## Certificación

```bash
npm run check
```

Este comando ejecuta auditoría estática, pruebas automatizadas y build de producción.

## Estado de integración

El trabajo acumulado en `foundation/event-bus-core` todavía no debe considerarse integrado en `main` hasta completar:

1. auditoría técnica integral;
2. cierre de hallazgos críticos y altos;
3. saneamiento de dependencias y pipeline;
4. contraste funcional contra los requisitos históricos;
5. hoja de ruta maestra;
6. aprobación y fusión del PR #26.

## Compatibilidad histórica

El nombre anterior se conserva únicamente donde sea indispensable para leer datos o migraciones heredadas. No representa la identidad comercial ni visual vigente del producto.
