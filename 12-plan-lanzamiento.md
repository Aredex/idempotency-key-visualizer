<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 12 · Plan de lanzamiento

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Preproducción

- [ ] Requisitos P0 y trazabilidad completos.
- [ ] Fixtures felices, límites y adversariales.
- [ ] Teclado, VoiceOver, zoom y movimiento reducido.
- [ ] CSP, cabeceras, dependencia caída y kill switch.
- [ ] Bundle/performance budgets.
- [ ] Privacidad, límites y ausencia de afirmaciones no medidas.
- [ ] Capturas y demo sin datos reales.

## Lanzamiento

- Publicar primero como enlace no indexado y realizar cinco pruebas observadas.
- Corregir bloqueos P0; aceptar P1 solo si no retrasa publicación.
- Publicar caso en alexcuesta.dev y repositorio etiquetado <code>v1.0.0</code>.
- Añadir una única muestra a Malt/Contra con copy específico.

## Métricas mínimas

Inicio de demo, ejecución, finalización, error tipado, exportación y apertura del repositorio. Sin payloads, identificadores personales ni fingerprinting.

## Criterios de decisión

- **Iterar:** ≥3/5 usuarios completan y al menos dos entienden el valor comercial.
- **Corregir antes de divulgar:** error P0, bloqueo accesible o fallback roto.
- **Detener:** mantenimiento externo recurrente, coste no acotable o ausencia total de comprensión tras dos iteraciones.

## Backlog posterior

1. Comparación de configuraciones.
2. Configuración compartible redactada.
3. Adaptador real opcional solo con demanda.
4. CLI/CI solo si un usuario técnico lo solicita.
