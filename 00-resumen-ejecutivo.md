<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 00 · Resumen ejecutivo

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Propuesta

**Idempotency Key Visualizer** permite a backend engineers que diseñan operaciones de pagos y escritura repetir una operación con la misma clave y cambiar el payload para observar cada transición, para resolver que es difícil razonar sobre claves repetidas, payloads conflictivos, expiración y concurrencia sin ver el estado.

## Diferenciación

explica idempotencia mediante un motor de eventos local reproducible y no mediante teoría. No compite por cantidad de funciones: convierte una capacidad técnica difícil de comprobar en una acción pública reproducible.

## Encaje con el portafolio

- Refuerza el posicionamiento en backend, APIs, cloud, automatización e IA.
- Complementa Briefline: aquí la evidencia central es ingeniería y comportamiento adversarial, no otro SaaS CRUD.
- Stack previsto: React, TypeScript, state machine, Web Worker.
- Evidencia de ofertas: `2086931498936109113`, `2088121585295677070`.
- Estimación MVP: **8–10 horas**.

## Decisión

**GO.** El problema es demostrable con un alcance pequeño, una experiencia pública clara y operación cercana a cero.

## Resultado público

En 30 segundos el visitante podrá repetir una operación con la misma clave y cambiar el payload para observar cada transición. En 90 segundos podrá revisar la explicación, cambiar un parámetro y exportar evidencia.
