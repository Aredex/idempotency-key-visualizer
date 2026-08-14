<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 11 · Despliegue y operación

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Entornos

- **Local:** fixtures y motor determinista; red opcional desactivada.
- **Preview:** cada PR, datos sintéticos y cabecera <code>noindex</code>.
- **Producción:** rama protegida, dominio bajo alexcuesta.dev y artefacto versionado.

## Hosting

**Cloudflare Pages; GitHub Pages como salida alternativa.** La aplicación es estática: lógica en TypeScript dentro del navegador, procesamiento pesado en Web Worker y persistencia opcional local. No existe backend público ni datos enviados fuera del dispositivo. Las cuotas deben verificarse de nuevo el día del despliegue; la documentación consultada queda enlazada abajo.

## CI/CD

1. Instalar con lockfile y verificar licencias.
2. Typecheck, lint y unit/contract tests.
3. Build con budgets y escaneo de secretos.
4. E2E, axe y smoke test en preview.
5. Promoción manual de artefacto inmutable.
6. Smoke de producción y enlace al rollback anterior.

## Observabilidad

- Error rate tipado, duración, cancelaciones y fallback; nunca payloads.
- Sentry opcional con scrubbing y sample bajo.
- Alerta solo para caída de demo, error P0 sostenido o gasto cercano al límite.

## Rollback y recuperación

Conservar dos artefactos previos; rollback por promoción del build anterior. Si falla Worker/D1, desactivar adaptador y servir modo determinista. RTO objetivo 30 min; RPO no aplica a datos de usuario porque no se conservan.

## Presupuesto

Objetivo **0–5 €/mes**. Sin método de pago cuando sea viable. Hard limits de invocaciones, tamaño y duración; alerta al 50/80%; kill switch para integración real.

## Runbook

1. Confirmar si falla estático, worker, almacenamiento o tercero.
2. Activar fallback local y publicar aviso breve.
3. Revisar versión, errores tipados y cambios recientes sin inspeccionar payloads.
4. Rollback si el fallo pertenece al release.
5. Registrar timeline y acción preventiva.

## Fuentes de límites

- [Cloudflare Pages — Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Workers — Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [WCAG 2.1](https://www.w3.org/TR/WCAG21/)

