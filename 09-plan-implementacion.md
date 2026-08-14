<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 09 · Plan de implementación

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Ruta crítica

Contrato → motor puro → fixture adversarial → experiencia 30/90 s → accesibilidad/pruebas → publicación → caso de estudio.

## Fases

### F0 — Base y contratos (2 h)

- <code>P5-T01</code> crear repositorio, TypeScript estricto, lint y tests.
- <code>P5-T02</code> implementar schemas de entrada/salida y fixtures mínimos.
- <code>P5-T03</code> montar shell visual y tokens.

### F1 — Corte vertical principal (35% de 8–10 h)

- `P5-T04` implementar P5-R1: distinguir reintento y conflicto.
- `P5-T05` implementar P5-R2: persistir el primer resultado.
- Añadir caso feliz, error tipado y evidencia exportable.

### F2 — Robustez del dominio (25%)

- `P5-T06` implementar P5-R3: simular concurrencia y expiración.
- `P5-T07` implementar P5-R4: explicar cada decisión.
- Añadir límites, cancelación, fixture adversarial y fallback.

### F3 — Experiencia pública (20%)

- Implementar recorrido 30/90 segundos y copy definitivo.
- Responsive, navegación por teclado, foco, estados y alternativa textual.
- Capturas automatizadas y guion de demo.

### F4 — Producción (20%)

- CI, pruebas completas, budgets de rendimiento y seguridad.
- Preview, smoke test, producción, rollback y caso de estudio.

## Dependencias

F1 depende de contratos; F2 puede avanzar junto a la UI únicamente después de estabilizar interfaces. Máximo tres workers: dominio, UI y calidad, sin compartir archivos en paralelo.

## Definición de listo

Requisito con ID, aceptación, fixture, contrato y diseño identificado.

## Definición de terminado

Código revisado, pruebas verdes, error/empty/loading, accesibilidad manual, evidencia generada, documentación y preview verificadas.

## Riesgos de ejecución

- **modelo demasiado simplificado:** disparador observable; mitigación: mostrar supuestos, límites y nivel de confianza; evitar lenguaje de certificación.
- **confundir idempotencia con exactly-once:** disparador observable; mitigación: fixture adversarial, validación explícita, mensaje accionable y prueba de regresión.
- **errores de reloj:** disparador observable; mitigación: fixture adversarial, validación explícita, mensaje accionable y prueba de regresión.
- **estado local corrupto:** disparador observable; mitigación: fixture adversarial, validación explícita, mensaje accionable y prueba de regresión.
- **terminología poco clara:** disparador observable; mitigación: fixture adversarial, validación explícita, mensaje accionable y prueba de regresión.

## Primera tarea exacta

Crear el repositorio de <code>idempotency-key-visualizer</code>, configurar TypeScript estricto y convertir <code>contracts/input.schema.json</code> y <code>contracts/output.schema.json</code> en tipos validados con un fixture feliz y uno inválido.
