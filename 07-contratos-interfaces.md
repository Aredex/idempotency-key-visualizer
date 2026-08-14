<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 07 · Contratos e interfaces

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Contratos nativos

- [contracts/input.schema.json](./contracts/input.schema.json): entrada estable del motor.
- [contracts/output.schema.json](./contracts/output.schema.json): resultado y hallazgos.
- No hay API HTTP en el MVP; las interfaces son módulos TypeScript locales.

## Interfaces de dominio

- `submitOperation(input)`
- `advanceClock(ms)`
- `resetScenario()`

## Envolvente de entrada

~~~json
{
  "schemaVersion": "1.0.0",
  "scenarioId": "happy-path",
  "payload": {},
  "options": { "deterministic": true }
}
~~~

## Envolvente de salida

~~~json
{
  "schemaVersion": "1.0.0",
  "runId": "run_fixture_001",
  "status": "completed",
  "summary": "Ejecución determinista completada",
  "findings": [],
  "evidence": { "rulesVersion": "1.0.0", "scenarioId": "happy-path" }
}
~~~

## Errores

| Código | HTTP opcional | Significado | Recuperación |
|---|---:|---|---|
| <code>INPUT_INVALID</code> | 400 | no cumple schema | señalar paths y conservar edición |
| <code>LIMIT_EXCEEDED</code> | 413 | tamaño/complejidad excedida | reducir entrada |
| <code>RUN_CANCELLED</code> | 409 | cancelación del visitante | permitir reinicio |
| <code>DEPENDENCY_UNAVAILABLE</code> | 503 | adaptador real no responde | ofrecer modo determinista |
| <code>INTERNAL_ERROR</code> | 500 | fallo no clasificado | ID de correlación sin payload |

## Versionado

SemVer para contratos. Un cambio incompatible crea versión mayor; la UI puede leer al menos la versión actual y anterior. Fixtures declaran la versión esperada y las pruebas de contrato bloquean publicación.
