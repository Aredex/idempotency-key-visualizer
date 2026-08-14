<!-- generated-by: $proyecto-portafolio; date: 2026-08-14 -->
# 02 · PRD

**Proyecto:** Idempotency Key Visualizer  
**Decisión:** GO  
**Versión del paquete:** 0.1 · 2026-08-14

## Problema

es difícil razonar sobre claves repetidas, payloads conflictivos, expiración y concurrencia sin ver el estado. Esto produce errores difíciles de detectar, decisiones no reproducibles y poca evidencia técnica para revisión o contratación.

## Personas

- **Operador principal:** backend engineers que diseñan operaciones de pagos y escritura.
- **Revisor:** lead, cliente o reclutador técnico que necesita evidencia en menos de dos minutos.
- **Visitante no técnico:** necesita una explicación en lenguaje natural, no solo métricas o JSON.

## Objetivos

1. Lograr que al menos 80% de cinco usuarios de prueba complete el escenario principal sin ayuda.
2. Mantener el tiempo hasta la primera acción por debajo de 30 segundos.
3. Cubrir 100% de requisitos P0 con pruebas y evidencia reproducible.
4. Funcionar sin VPS y conservar el modo determinista aun si falla cualquier tercero.

## No-objetivos

- Ser una plataforma multiempresa o servicio comercial completo.
- Procesar datos reales sensibles por defecto.
- Reproducir todas las capacidades de herramientas enterprise.
- Prometer precisión, seguridad o ahorro no medidos.

## P0

### P5-R1 — distinguir reintento y conflicto

- **Given** un fixture válido y el modo determinista activo.
- **When** el visitante ejecuta la acción asociada.
- **Then** obtiene resultado, explicación, errores tipados y evidencia exportable sin red obligatoria.

### P5-R2 — persistir el primer resultado

- **Given** un fixture válido y el modo determinista activo.
- **When** el visitante ejecuta la acción asociada.
- **Then** obtiene resultado, explicación, errores tipados y evidencia exportable sin red obligatoria.

### P5-R3 — simular concurrencia y expiración

- **Given** un fixture válido y el modo determinista activo.
- **When** el visitante ejecuta la acción asociada.
- **Then** obtiene resultado, explicación, errores tipados y evidencia exportable sin red obligatoria.

### P5-R4 — explicar cada decisión

- **Given** un fixture válido y el modo determinista activo.
- **When** el visitante ejecuta la acción asociada.
- **Then** obtiene resultado, explicación, errores tipados y evidencia exportable sin red obligatoria.

## P1

- Comparación lado a lado de dos configuraciones.
- Enlace compartible sin incluir payloads privados.
- Importación/exportación de configuración versionada.

## P2

- Adaptador opcional a un proveedor o ejecución real.
- Integración CI mediante paquete o comando, si la validación demuestra demanda.

## Historias

- Como backend engineers que diseñan operaciones de pagos y escritura, quiero repetir una operación con la misma clave y cambiar el payload para observar cada transición para decidir con evidencia.
- Como revisor, quiero abrir un resultado y rastrear sus supuestos para evaluar la calidad técnica.
- Como visitante con teclado o lector de pantalla, quiero completar el flujo sin perder contexto.
- Como responsable de seguridad, quiero saber qué datos salen del navegador y poder eliminarlos.

## Métricas

| Métrica | Éxito v1 | Método |
|---|---:|---|
| Primera acción | ≤30 s | evento local sin payload |
| Finalización del escenario | ≥80% en 5 pruebas | sesión observada |
| Error no explicado | 0 en fixtures P0 | suite E2E |
| Requisito P0 trazado | 100% | <code>14-trazabilidad.md</code> |

## Preguntas no bloqueantes

- **Producto:** ¿qué escenario genera más conversaciones comerciales? Resolver tras cinco demos.
- **Diseño:** ¿comparación simultánea o secuencial? Validar con prototipo.
- **Ingeniería:** ¿merece un adaptador real? Solo después de validar el modo determinista.
