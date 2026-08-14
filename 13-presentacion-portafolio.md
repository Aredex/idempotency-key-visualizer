<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 13 · Presentación de portafolio

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

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
