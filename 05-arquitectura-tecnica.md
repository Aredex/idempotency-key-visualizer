<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 05 · Arquitectura técnica

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Decisión de arquitectura

La aplicación es estática: lógica en TypeScript dentro del navegador, procesamiento pesado en Web Worker y persistencia opcional local. No existe backend público ni datos enviados fuera del dispositivo.

~~~mermaid
flowchart LR
    V[Visitante] --> UI[React workbench]
    UI --> E[Web Worker / motor local]
    E --> S[IndexedDB / memoria local]
    E --> F[Fixtures versionados]
    F --> UI
~~~

## Componentes

| Componente | Responsabilidad |
|---|---|
| <code>web</code> | navegación, entrada, resultado y accesibilidad |
| <code>domain</code> | reglas puras de idempotency key visualizer |
| <code>worker</code> | procesamiento cancelable fuera del hilo principal |
| <code>fixtures</code> | escenarios versionados, felices y adversariales |
| <code>contracts</code> | schemas de entrada, salida y errores |
| <code>adapter</code> | integración externa opcional y sustituible |

## Stack

- React
- TypeScript
- state machine
- Web Worker

## Presupuestos

- JavaScript inicial ≤180 KB gzip; módulos pesados bajo demanda.
- Primera interacción ≤2 s en portátil medio con fixture incluido.
- Operación normal ≤500 ms o progreso/cancelación visible si excede ese tiempo.
- Archivo local inicial ≤10 MB salvo medición que justifique ampliarlo.
- Cero solicitudes externas durante el modo determinista.

## Configuración y secretos

<code>local</code>, <code>preview</code> y <code>production</code> comparten contratos. Ningún secreto en variables <code>PUBLIC_*</code>. El adaptador real, si existe, lee secretos exclusivamente en Worker y está deshabilitado sin configuración.

## ADR-001 — Sin VPS

- **Contexto:** el portafolio no debe mantener procesos encendidos.
- **Decisión:** Cloudflare Pages; GitHub Pages como salida alternativa con modo determinista.
- **Alternativas:** VPS, contenedor permanente y SaaS de terceros.
- **Consecuencia:** menor carga operativa; algunas capacidades reales se demuestran mediante fixtures.

## ADR-002 — Núcleo funcional

Las reglas del dominio serán funciones puras con entradas/salidas tipadas. React orquesta interacción; no contiene decisiones del dominio. Esto permite usar las mismas reglas en UI, tests y futuro CLI.

## ADR-003 — Evidencia primero

Cada ejecución genera un <code>runId</code>, versión de reglas, fixture y lista de decisiones. La exportación excluye payloads privados por defecto.

## Fuentes

- [AWS Lambda — Idempotency](https://docs.aws.amazon.com/lambda/latest/dg/durable-execution-idempotency.html)
- [AWS Lambda with SQS](https://docs.aws.amazon.com/lambda/latest/dg/with-sqs.html)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
- [Cloudflare Pages — Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Workers — Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)
