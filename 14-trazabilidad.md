<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 14 · Trazabilidad

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Matriz P0

| Requisito | Flujo | Componente | Contrato | Tarea | Prueba | Evidencia pública |
|---|---|---|---|---|---|---|
| P5-R1 | ejecutar → revisar | domain + web | input/output v1 | P5-T04 | unit/contract/e2e-1 | captura + export fixture |
| P5-R2 | ejecutar → revisar | domain + web | input/output v1 | P5-T05 | unit/contract/e2e-2 | captura + export fixture |
| P5-R3 | ejecutar → revisar | domain + web | input/output v1 | P5-T06 | unit/contract/e2e-3 | captura + export fixture |
| P5-R4 | ejecutar → revisar | domain + web | input/output v1 | P5-T07 | unit/contract/e2e-4 | captura + export fixture |

## Objetivos

| Objetivo | Evidencia prevista |
|---|---|
| Primera acción ≤30 s | grabación E2E y prueba observada |
| Finalización ≥80% | informe de cinco sesiones, cuando existan |
| 100% P0 trazado | esta matriz + CI |
| Sin VPS ni tercero obligatorio | prueba offline y fallback en preview |

## Auditoría de huérfanos

- Requisitos P0 sin tarea: **0**.
- Requisitos P0 sin prueba: **0**.
- Afirmaciones públicas sin evidencia prevista: **0**; las métricas reales permanecen pendientes y no se publican.
- P1/P2 no bloquean v1 y no se presentan como implementados.
