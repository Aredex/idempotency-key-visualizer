<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 15 · Registro de decisiones

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Supuestos

- El visitante acepta trabajar con fixtures antes de aportar datos propios.
- La muestra se evalúa como evidencia profesional, no como producto enterprise.
- El coste y la operación continua deben permanecer cercanos a cero.
- La integración real es secundaria frente a la demostración determinista.

## ADRs resumidos

| ID | Decisión | Estado | Consecuencia |
|---|---|---|---|
| ADR-001 | Cloudflare Pages; GitHub Pages como salida alternativa | aceptada | no VPS; límites de plataforma |
| ADR-002 | motor de dominio puro | aceptada | testeable y reutilizable |
| ADR-003 | fixtures como fallback | aceptada | demo estable; realidad acotada |
| ADR-004 | sin cuentas en v1 | aceptada | menor riesgo y tiempo |

## Cambio de alcance inicial

No se requiere reducción material. El alcance queda limitado a cuatro requisitos P0, una sola experiencia pública y datos sintéticos.

## Preguntas no bloqueantes

- ¿Cuál fixture debe aparecer primero tras pruebas con usuarios?
- ¿La exportación más útil es Markdown, JSON o ambas?
- ¿Un adaptador real mejora conversión lo suficiente para asumir mantenimiento?

## Parking lot

- Cuentas, equipos y colaboración.
- Integraciones empresariales y marketplaces.
- Procesamiento de datos reales o sensibles.
- Monetización, billing y SLA.
- Aplicación móvil nativa.
