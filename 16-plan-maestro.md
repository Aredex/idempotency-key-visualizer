<!-- generated-by: plan-maestro; date: 2026-08-14 -->
# 16 · Plan maestro de ejecución

**Proyecto:** 5. idempotency-key-visualizer — **Decisión:** GO · **Horas MVP:** 8–10h · **Modo:** estático

## Objetivo

Repetir una operación con la misma clave de idempotencia y payload cambiante, viendo cada transición en una máquina de estados local.

## Mapeo de requisitos a fases

- **F1 (corte vertical principal):** distinguir reintento de conflicto · persistir el primer resultado.
- **F2 (robustez del dominio):** simular concurrencia y expiración · explicar cada decisión.

## Riesgo a vigilar especialmente

Confundir idempotencia con exactly-once → mostrar supuestos/límites/confianza, evitar lenguaje de certificación.

## Despliegue

Estándar.

## Patrón común de ejecución (compartido por los 29 proyectos del portafolio)

Este documento complementa los 16 anteriores (00–15) con el plan de ejecución acordado a nivel de portafolio. No repite el contenido de `09-plan-implementacion.md`, `11-despliegue-operacion.md` ni `12-plan-lanzamiento.md` (ya definidos); añade el contexto compartido y el mapeo concreto de requisitos a fases.

**Fases internas (idénticas en los 29 proyectos):**
- **F0 — Base y contratos (2h fijas):** crear repo desde el starter compartido del portafolio, tipar `contracts/input.schema.json` y `output.schema.json` con fixture feliz + inválido, montar shell visual/tokens.
- **F1 — Corte vertical principal (35% de las horas MVP):** implementar los 2 primeros requisitos (R1, R2) + caso feliz + error tipado + evidencia exportable.
- **F2 — Robustez del dominio (25%):** implementar los 2 requisitos restantes (R3, R4) + límites + cancelación + fixture adversarial + fallback.
- **F3 — Experiencia pública (20%):** recorrido demo 30/90s, copy definitivo, responsive, teclado/foco/estados, capturas automatizadas.
- **F4 — Producción (20%):** CI completo, budgets rendimiento/seguridad, preview → smoke → producción → rollback, caso de estudio.
- Máx. 3 líneas de trabajo en paralelo (dominio / UI / calidad), sin tocar los mismos archivos.

**Infraestructura de portafolio (se construye una sola vez, no por proyecto):** starter template TypeScript estricto + Vitest + Testing Library, pipeline CI/CD reutilizable (GitHub Actions), cuenta Cloudflare única (Pages por repo + namespace de Workers compartido para los proyectos que lo requieren), dominio `alexcuesta.dev/<slug>`, página índice del portafolio. El presupuesto "0–5€/mes" es un techo **agregado de la cuenta**, no por proyecto individual.

**Despliegue estándar:** Cloudflare Pages (GitHub Pages como alternativa), 100% estático — TS en navegador + Web Worker, sin backend, sin datos de usuario saliendo del dispositivo. CI/CD de 6 pasos: instalar con lockfile + revisar licencias → typecheck/lint/tests → build con budgets + escaneo de secretos → E2E + axe + smoke en preview → promoción manual de artefacto inmutable → smoke en producción + link a rollback. RTO 30min.

**Seguridad base (7 controles obligatorios):** CSP restrictiva + `frame-ancestors 'none'` + `nosniff` + Referrer-Policy · dependencias fijadas/lockfile/licencias/alerta de vulnerabilidades · validación JSON Schema con límites de profundidad/tamaño/cantidad/tiempo · prohibido `innerHTML` con input de usuario ni ejecutar código pegado · no loggear payloads/tokens/archivos/prompts/cabeceras · exportación con redacción + `Content-Disposition: attachment` · rate limit + kill switch en toda función pública.

**Checklist de lanzamiento (idéntico en los 29):** requisitos P0 + trazabilidad, fixtures felices/límite/adversariales, accesibilidad (teclado/VoiceOver/zoom/movimiento reducido), CSP/cabeceras/dependencia-caída/kill-switch, budgets de bundle/rendimiento, privacidad sin afirmaciones no medidas, capturas/demo sin datos reales → publicar como enlace no indexado → 5 pruebas observadas → corregir bloqueos P0 → publicar en `alexcuesta.dev` + repo con tag `v1.0.0` → una muestra en Malt/Contra. Gates: **iterar** si ≥3/5 completan y ≥2 entienden el valor comercial; **corregir antes de divulgar** si hay error P0/bloqueo de accesibilidad/fallback roto; **detener** si hay mantenimiento externo recurrente o coste no acotable.

## Verificación (al cerrar F4, antes de producción)

1. `pnpm typecheck && pnpm lint && pnpm test` (unit + contrato) en verde.
2. Build con budgets de bundle/rendimiento dentro de límite + escaneo de secretos limpio.
3. E2E + axe sin violaciones críticas/serias en preview (enlace no indexado).
4. 5 pruebas observadas reales antes de promover a producción.
5. Smoke test en producción tras la promoción manual + confirmar que el rollback al artefacto anterior funciona.
6. Enlazar el caso de estudio en la página índice del portafolio.
