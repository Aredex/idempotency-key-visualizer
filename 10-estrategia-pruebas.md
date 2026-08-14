<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 10 · Estrategia de pruebas

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Capas

- **Unitarias:** reglas puras, límites, normalización y mensajes.
- **Contrato:** schemas, compatibilidad y fixtures versionados.
- **Integración:** worker/adaptador, cancelación y persistencia local.
- **E2E:** recorrido 30/90 s, error, recuperación y exportación.
- **Seguridad:** entradas adversariales, límites y ausencia de secretos.
- **Accesibilidad:** axe más teclado/VoiceOver manual.
- **Rendimiento:** fixture base y máximo soportado.

## Matriz

| Requisito | Unit | Contrato | Integración | E2E | Evidencia |
|---|---|---|---|---|---|
| P5-R1 | `unit-1` | `contract-1` | `integration-1` | `e2e-1` | captura + export |
| P5-R2 | `unit-2` | `contract-2` | `integration-2` | `e2e-2` | captura + export |
| P5-R3 | `unit-3` | `contract-3` | `integration-3` | `e2e-3` | captura + export |
| P5-R4 | `unit-4` | `contract-4` | `integration-4` | `e2e-4` | captura + export |

## Fixtures mínimos

1. <code>happy-path</code>: resultado comprensible sin advertencias críticas.
2. <code>invalid-input</code>: varios paths inválidos con corrección.
3. <code>boundary</code>: tamaño o cantidad exactamente en el límite.
4. <code>adversarial</code>: contenido hostil sin ejecución ni filtración.
5. <code>dependency-down</code>: adaptador real falla y activa fallback.

## Gates

- 100% de ramas de reglas P0 y ≥80% del dominio; UI medida por comportamiento.
- Cero violaciones axe críticas/serias en flujos P0.
- Ningún snapshot como única prueba de una decisión.
- Bundle, tiempo de primera interacción y memoria dentro del presupuesto.
- OpenAPI/JSON Schema válidos y sin cambios incompatibles no aprobados.
- Smoke test en preview y producción.
