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

## Incidente de QA cerrado antes de v1.0.0

Antes de publicar, una revisión de riesgo dedicada (obligatoria por tocar concurrencia y varios módulos) encontró un fallo **crítico**: al simular una petición concurrente (`EngineRuntime`) sobre una clave que ya tenía un resultado guardado, el registro durable se sobrescribía con el centinela `in-progress` y se perdía (`fingerprint`, `storedOutput`, `storedPayload`, `expiresAtMs`). La solicitud propietaria del lock terminaba reportándose como "primera ejecución" con un `runId` nuevo en vez de como reintento — contradiciendo, en el camino de interacción más obvio (ejecutar y luego pulsar "Simular petición concurrente"), la afirmación central del producto de que el resultado guardado no se sobrescribe. Ninguna prueba existente lo detectaba porque todas lanzaban la carrera sobre una clave virgen.

Se corrigió preservando el registro previo bajo el centinela de "en curso" y restaurándolo al resolver, con pruebas de regresión añadidas en las tres capas (unit/integración sobre `EngineRuntime`, y un caso E2E contra Chromium real) que fallan con el código anterior y pasan con la corrección. La misma revisión encontró y cerró un problema de residuo de datos tras "Eliminar datos locales" (temporizadores/llaves en vuelo no se limpiaban) y dos gaps menores (longitud de cadena sin límite rompiendo el layout del diff; dos líneas de copy en la UI sin el matiz "no es exactly-once" que sí llevaba el texto del motor). Detalle completo en el historial de commits del repositorio (`git log`) y en `README.md` §Pruebas y evidencia.

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
