<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 13 · Presentación de portafolio

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14  
**Estado:** publicado — `v1.0.0`

## Producción

- **URL real:** https://idempotency-key-visualizer.pages.dev
- **Dominio del portafolio** (pendiente de que el orquestador central adjunte el registro DNS): `https://idempotency-key-visualizer.alexcuesta.dev`
- **Repositorio:** https://github.com/Aredex/idempotency-key-visualizer (público, tag `v1.0.0`)
- **CI (GitHub Actions):** en verde — job `quality` (lint, typecheck, 278 tests unit/contrato/integración, build) y job `e2e` (36 tests Playwright, incl. axe) pasando en `ubuntu-24.04` / Node 24 / pnpm 10.

## Sustituto de las "5 pruebas observadas"

No hubo usuarios humanos disponibles para esta ronda de lanzamiento. En su lugar, el sustituto automático documentado en `12-plan-lanzamiento.md`/el playbook del portafolio es la suite E2E: recorrido feliz de 30 s (primera ejecución + reintento con el mismo identificador), recorrido extendido de 90 s (conflicto con diff accesible + exportación), y dos casos límite/adversariales (contenido hostil renderizado como texto inerte, entrada inválida rechazada con foco en el error) — 36 pruebas en total, más 7 escaneos de accesibilidad con axe-core en distintos estados de la app, todas en verde sobre Chromium real en CI. Esto es evidencia de que los caminos son recorribles y accesibles a nivel de máquina; **no sustituye** una validación real de si un visitante humano entiende, sin ayuda, la diferencia entre idempotencia observada y exactly-once — eso queda pendiente de las próximas iteraciones del portafolio, con métricas honestas y no inventadas.

Una revisión de riesgo dedicada, además, encontró y cerró antes de esta publicación un fallo crítico: simular una petición concurrente sobre una clave ya completada podía destruir el resultado guardado y reportar un reintento como una primera ejecución nueva — contradiciendo la promesa central del producto en el camino de interacción más obvio. Quedó corregido con pruebas de regresión en las tres capas (unit, integración, E2E) antes del tag `v1.0.0`. Ver `15-registro-decisiones.md` y el historial de commits del repositorio para el detalle.

## Titular

**Idempotency Key Visualizer: Explica idempotencia mediante un motor de eventos local reproducible y no mediante teoría.**

## Caso de estudio

1. Problema: es difícil razonar sobre claves repetidas, payloads conflictivos, expiración y concurrencia sin ver el estado.
2. Restricción: demostrarlo sin VPS, datos privados ni dependencia permanente.
3. Decisión: La aplicación es estática: lógica en TypeScript dentro del navegador, procesamiento pesado en Web Worker y persistencia opcional local. No existe backend público ni datos enviados fuera del dispositivo.
4. Prueba: acción pública, fixtures adversariales, contratos y suite reproducible.
5. Resultado: publicar solo métricas obtenidas después de pruebas reales.

## Guion de demo (60–90 s)

- **0–10 s:** “Este proyecto hace visible un fallo que normalmente aparece tarde.”
- **10–30 s:** ejecutar fixture: repetir una operación con la misma clave y cambiar el payload para observar cada transición.
- **30–55 s:** abrir una decisión, su evidencia y corrección.
- **55–75 s:** cambiar un parámetro y demostrar resultado distinto.
- **75–90 s:** mostrar contratos, pruebas y arquitectura sin VPS.

## Capturas

1. Workbench antes de ejecutar.
2. Resultado con evidencia abierta.
3. Caso adversarial o comparación.
4. Diagrama de arquitectura.
5. Test/contrato que prueba la promesa central.

## README público

Problema, demo, inicio local, arquitectura, fixtures, comandos, seguridad, accesibilidad, límites honestos y decisiones. Evitar badges sin valor y listas de tecnologías sin explicar decisiones.

## Textos reutilizables

### Malt

“Diseñé Idempotency Key Visualizer, una demo interactiva para es difícil razonar sobre claves repetidas, payloads conflictivos, expiración y concurrencia sin ver el estado. Incluye React, TypeScript, state machine, escenarios reproducibles y despliegue sin servidor dedicado.”

### Upwork

“Tengo una muestra pública relacionada: Idempotency Key Visualizer. Permite repetir una operación con la misma clave y cambiar el payload para observar cada transición e incluye contratos, casos adversariales y pruebas. Puedo compartir el enlace y explicar qué parte se adapta a su alcance.”

### LinkedIn

“Convertí un problema difícil de enseñar —es difícil razonar sobre claves repetidas, payloads conflictivos, expiración y concurrencia sin ver el estado— en una demo que se puede probar en menos de 90 segundos. Próximamente publicaré decisiones, fallos encontrados y evidencia reproducible; no métricas inventadas.”
