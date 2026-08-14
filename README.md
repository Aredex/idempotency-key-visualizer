# Idempotency Key Visualizer

Repite una operación con la misma clave de idempotencia mientras cambias el payload, y observa cada decisión que tomaría un backend real: primera ejecución, reintento, conflicto, carrera de concurrencia simulada y expiración por TTL — explicada en lenguaje llano, con supuestos y nivel de confianza, nunca como una garantía.

Demo pública: **https://idempotency-key-visualizer.pages.dev**
(el dominio `https://idempotency-key-visualizer.alexcuesta.dev` quedará activo cuando se adjunte el registro DNS del portafolio).

## Problema

Es difícil razonar sobre claves repetidas, payloads conflictivos, expiración y concurrencia sin ver el estado. Un backend engineer que diseña operaciones de pagos o escritura suele descubrir estos casos en producción, no en el diseño: dos reintentos que llegan casi a la vez, un cliente que reenvía la misma clave con un payload distinto, una clave que expira justo antes de que llegue el reintento. Este proyecto convierte esas cuatro decisiones en algo que se puede pulsar, ver y explicar en menos de 90 segundos.

## Qué NO es

**No es una prueba de exactly-once delivery.** Es el riesgo #1 identificado en el diseño de este proyecto (ver `08-seguridad-privacidad.md`): confundir "idempotencia observada en un simulador local" con "garantía de exactly-once en un sistema distribuido real". Este motor corre entero en tu navegador, con un reloj lógico propio y sin red — demuestra el *razonamiento* de un backend idempotente, no certifica que ningún sistema real (incluido uno que tú construyas) se comporte igual. Cada decisión de la UI incluye sus supuestos y un nivel de confianza (alta/media/baja) en vez de lenguaje de certificación.

## Demo

1. Elige un escenario precargado (o edita el payload JSON tú mismo).
2. Pulsa **Ejecutar escenario** — la primera vez, el motor guarda el resultado.
3. Vuelve a ejecutar sin cambiar nada → **reintento**: se devuelve el mismo resultado guardado, con el mismo identificador de ejecución, sin volver a "procesar" nada.
4. Edita un campo del payload y ejecuta → **conflicto**: la clave ya tiene un resultado guardado con una huella distinta; se rechaza sin sobrescribirlo, y se muestra un diff estructural (texto, no solo color) de qué cambió.
5. Pulsa **Simular petición concurrente** → una segunda solicitud para la misma clave, lanzada mientras la primera sigue "procesando", queda bloqueada por una guarda de concurrencia — una ventana de carrera simulada en un único hilo, no concurrencia real de threads/procesos.
6. Avanza el reloj simulado más allá del TTL de la clave y ejecuta de nuevo → **expiración**: la clave se trata como nueva. Esto solo reinicia el simulador local; no dice nada sobre si la operación original volvería a ejecutarse en un sistema real aguas arriba.
7. Exporta el resultado guardado como Markdown o JSON (con el payload de ejemplo redactado si lo incluyes) para revisión o portafolio.

Nada de esto sale del navegador: no hay cuenta, no hay backend propio, no hay llamadas de red durante el modo determinista (el único, activo por defecto). Un interruptor "Modo determinista" existe para mostrar qué pasaría si se pidiera una integración real: como esa integración está desactivada por diseño (kill switch permanente, `src/domain/adapter.ts`), la app explica el *fallback* y sigue resolviendo de forma determinista — nunca intenta una llamada real.

## Arquitectura

Aplicación 100% estática — sin backend propio, sin datos que salgan del dispositivo.

```
Visitante → React (workbench) → Web Worker (motor de idempotencia)
                                       │
                          fixtures versionados + contratos JSON Schema
```

- **`src/domain/`** — el motor puro: máquina de estados de idempotencia (`engine.ts`), validador de entrada escrito a mano (`envelope.ts` — deliberadamente sin `ajv` en el navegador, ver más abajo), fingerprint canónico por SHA-256 (`hash.ts`), reglas de decisión (`rules.ts`), exportación con redacción (`exportReport.ts`), escenarios (`fixtures/scenarios.ts`).
- **`src/domain/runtime.ts`** (`EngineRuntime`) — la única capa con temporizadores/estado mutable: simula latencia de procesamiento, cancelación y la ventana de carrera de concurrencia sobre el motor puro y síncrono.
- **`src/worker/`** — el motor corre en un Web Worker; si el navegador no puede crear uno, `WorkerClient` cae automáticamente a ejecutar el mismo `EngineRuntime` en el hilo principal (mismo código, mismo comportamiento — es la resiliencia descrita en `11-despliegue-operacion.md`).
- **`src/ui/`** — React + TypeScript, HTML semántico, sin librerías de componentes.

### Por qué no hay `ajv` en el bundle del navegador

`contracts/input.schema.json` y `contracts/output.schema.json` son la fuente de verdad, pero `ajv` compila validadores con `new Function(...)` en tiempo de ejecución — eso exigiría `'unsafe-eval'` en la Content-Security-Policy. Se prefirió una CSP `script-src 'self'` estricta a la comodidad de un compilador genérico: `src/domain/envelope.ts` reimplementa a mano las mismas reglas que describe el schema, y `tests/contract/` usa `ajv` en Node (nunca en el navegador) para comprobar que ese validador manual no ha divergido del JSON Schema.

## Fixtures

| Escenario | Qué demuestra |
|---|---|
| Cobro con tarjeta | camino feliz: primera ejecución, reintento, conflicto, TTL largo (24h) |
| Reservar inventario | TTL corto (5s) pensado para demostrar expiración sin esperar |
| Caso límite: 200 propiedades | exactamente en el límite `maxProperties` del contrato de entrada — válido |
| Caso adversarial | contenido hostil (`<img onerror=...>`, `<script>`, cadenas muy largas) — se renderiza como texto inerte, nunca se ejecuta |

Un preset adicional carga JSON deliberadamente inválido para demostrar el camino de error sin llegar a despachar nada al motor.

## Inicio local

Requiere Node ≥24 y pnpm 10.

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

## Comandos

```bash
pnpm typecheck    # tsc -b --noEmit
pnpm lint         # eslint .
pnpm test         # vitest — unit + contrato + integración
pnpm build        # tsc -b && vite build
pnpm test:e2e     # playwright — recorrido 30/90s + casos límite + axe
```

## Seguridad y privacidad

- **CSP restrictiva** (`public/_headers`): `script-src 'self'` sin `'unsafe-eval'` ni `'unsafe-inline'`, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` restrictiva.
- **Sin `innerHTML`, sin `eval`/`new Function`** en ningún punto del código de la aplicación (todo el contenido derivado de payload se renderiza como texto JSX plano — así es como el escenario adversarial demuestra que no se ejecuta nada).
- **Validación estricta**: límites de tamaño (`maxProperties: 200`), profundidad, cantidad de nodos y longitud de cadena aplicados antes de procesar cualquier payload; una entrada que los excede se rechaza con un hallazgo tipado, nunca en silencio.
- **Sin logging de payloads**: no hay ninguna llamada a `console.*` en el código de la aplicación que incluya contenido de payload, hallazgos o exportaciones.
- **Exportación redactada por defecto**: el payload de ejemplo es opt-in y, cuando se incluye, pasa por una lista de bloqueo (`email`, `token`, `secret`, `password`, `authorization`, `card`, `cvv`) antes de serializarse; la descarga usa `Blob` + `<a download>`, el equivalente del lado del cliente a `Content-Disposition: attachment` (no hay servidor propio que pueda fijar esa cabecera).
- **Kill switch permanente**: el adaptador a una integración real (`src/domain/adapter.ts`) está desactivado por diseño (`REAL_ADAPTER_ENABLED = false`); no existe ninguna llamada de red condicional que pudiera activarse por error de configuración.
- **Sin persistencia**: ni `localStorage`, ni `indexedDB`, ni cookies. El estado vive en memoria y se borra al recargar o con el botón "Eliminar datos locales".

## Accesibilidad

WCAG 2.1 AA como objetivo: HTML nativo antes que ARIA, landmarks y jerarquía de encabezados coherente, contraste ≥4.5:1 en texto normal, foco visible de 2px en todo elemento interactivo, operación completa por teclado (`Escape` cancela una ejecución en curso o cierra un detalle abierto), una única región `aria-live="polite"` que anuncia el resultado sin ser ruidosa, errores enlazados a su campo con resumen enfocable, `prefers-reduced-motion` respetado, y un diff de conflicto con equivalente textual completo (nunca depende solo del color). Verificado con `@axe-core/playwright` en cuatro estados de la app (inicial, resultado poblado, conflicto, tras una guarda de concurrencia) — sin violaciones críticas o serias — más navegación manual solo teclado.

## Límites honestos

- El simulador modela una **única solicitud en vuelo por clave**; no reproduce condiciones de carrera reales entre múltiples procesos, ni locks distribuidos, ni particiones de red.
- La huella del payload es un hash canónico (SHA-256 sobre JSON con claves ordenadas); dos payloads semánticamente distintos que serialicen igual (por ejemplo, por pérdida de precisión numérica) no se distinguirían — un caso de borde documentado, no cubierto en v1.
- La ventana de concurrencia y el reloj de expiración son puramente lógicos (`clockMs` interno), no relojes de pared reales — intencional, para que la demo sea determinista y reproducible en CI.
- No hay comparación lado a lado de dos configuraciones ni enlaces compartibles versionados (backlog documentado en `12-plan-lanzamiento.md`, fuera del alcance P0).

## Pruebas y evidencia

- **Unitarias + contrato + integración** (Vitest): 278 pruebas — motor puro, validador manual cruzado contra `ajv` sobre los mismos schemas, fingerprint, exportación/redacción, y un test dedicado que escanea todo el copy generado (dominio + UI) en busca de lenguaje de certificación ("garantizado", "certificado", "100% seguro", "nunca falla") como regresión permanente del riesgo #1 del producto.
- **E2E** (Playwright + Chromium real): 36 pruebas — recorrido feliz de 30s, recorrido extendido de 90s (conflicto, exportación), simulación de concurrencia sobre una clave ya completada, expiración por TTL, contenido adversarial, entrada inválida, y accesibilidad automatizada (axe) en cuatro estados.
- **Sustituto de las "5 pruebas observadas"**: no hubo usuarios humanos disponibles para esta ronda. La suite E2E anterior (30s + 90s + 2 casos límite/adversariales + axe) es el sustituto automático documentado en el plan de lanzamiento — verifica que los caminos son recorribles y accesibles a nivel de máquina, pero no dice nada sobre si una persona entiende, sin ayuda, la diferencia entre idempotencia y exactly-once al leer la pantalla. Eso queda pendiente de validación humana real antes de iterar el producto.
- Una revisión de riesgo dedicada (concurrencia, privacidad de exportación, superficie XSS, honestidad del mensaje) encontró y corrigió un fallo crítico antes de esta versión: simular una petición concurrente sobre una clave ya completada podía destruir el resultado guardado y reportar un reintento como si fuera una primera ejecución nueva — ver `15-registro-decisiones.md` para el detalle. Quedó cerrado con pruebas de regresión en las tres capas (unit, integración, E2E) antes de publicar `v1.0.0`.

## Decisiones de diseño

- **Sin backend propio.** Toda la lógica corre en el navegador; el Web Worker es procesamiento local, no un servicio remoto. Ver ADR-001/002/003 en `05-arquitectura-tecnica.md`.
- **Motor puro + runtime con estado separados** (`engine.ts` vs. `runtime.ts`): las decisiones del dominio son funciones síncronas sin efectos, fáciles de probar exhaustivamente; los temporizadores, la cancelación y los locks de concurrencia viven en una capa aparte que envuelve al motor. Esa separación es lo que permite reproducir concurrencia y cancelación de forma determinista en tests, sin `sleep`s frágiles.
- **`options.deterministic`** del contrato de entrada no es un campo decorativo: es el punto de enganche real del kill switch — pedir el modo "no determinista" es justamente lo que dispara la explicación de por qué la integración real está desactivada.

## Stack

React, TypeScript estricto, Web Worker, Vitest + Testing Library, Playwright, ESLint (typescript-eslint) + Prettier. Cloudflare Pages para hosting estático.

## Repositorio y licencia

Código en este repositorio. Parte del portafolio técnico de [alexcuesta.dev](https://alexcuesta.dev).
