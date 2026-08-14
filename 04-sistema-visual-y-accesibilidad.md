<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 04 · Sistema visual y accesibilidad

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Dirección

Concepto: **explorador técnico interactivo**. La interfaz será una sola mesa de trabajo editorial, no un dashboard de tarjetas. Debe sentirse parte de alexcuesta.dev mediante tipografía sobria, fondo cálido y lenguaje directo, pero utilizará una composición propia.

## Tokens iniciales

| Token | Valor | Uso |
|---|---|---|
| <code>color.canvas</code> | <code>#F6F3ED</code> | fondo principal |
| <code>color.ink</code> | <code>#172033</code> | texto |
| <code>color.accent</code> | <code>#2F6BFF</code> | acción y foco |
| <code>color.support</code> | <code>#183153</code> | estados informativos |
| <code>space.1/2/3/4/6/8</code> | <code>4/8/12/16/24/32px</code> | ritmo |
| <code>radius.control</code> | <code>8px</code> | controles, no contenedores indiscriminados |
| <code>motion.fast/base</code> | <code>120/200ms</code> | feedback y transición |

Tipografía: sans legible para interfaz y mono únicamente en contratos, datos y evidencias. Ancho de lectura máximo: 72 caracteres.

## Componentes

- Selector de escenario y editor de entrada.
- Botón de ejecución con estado y cancelación.
- Timeline o lista de decisiones, según contenido.
- Finding con severidad, evidencia y corrección.
- Diff semántico accesible; no depender solo del color.
- Exportación, aviso de privacidad y límites.

## Responsive

- **Móvil:** entrada y resultado en secuencia; CTA persistente sin cubrir contenido.
- **Tableta:** paneles apilables con índice de resultado.
- **Escritorio:** dos columnas 40/60 y detalle lateral opcional.

## WCAG 2.1 AA

- HTML nativo antes que ARIA; encabezados y landmarks coherentes.
- Contraste ≥4.5:1 para texto normal y ≥3:1 para texto grande/componentes.
- Foco visible con 2 px y separación; orden igual al visual.
- Teclado completo, Escape recuperable y anuncios <code>aria-live</code> moderados.
- Errores enlazados al campo y resumen enfocable.
- <code>prefers-reduced-motion</code>: eliminar desplazamientos y animar solo opacidad.
- Gráficas y diffs incluyen tabla o resumen textual equivalente.

## Verificación

axe automatizado, Testing Library para nombres/roles, recorrido manual solo teclado, VoiceOver + Safari y zoom 200/400% antes de publicar.
