/**
 * Límites duros del motor. Se aplican antes de procesar nada, para que un
 * payload hostil o desmesurado falle rápido con LIMIT_EXCEEDED en lugar de
 * colgar el hilo del worker.
 */
export const LIMITS = {
  /** contracts/input.schema.json: payload.maxProperties */
  MAX_PAYLOAD_PROPERTIES: 200,
  /** Profundidad máxima recorrida al validar el payload recursivamente. */
  MAX_PAYLOAD_DEPTH: 6,
  /** Tope cooperativo de nodos visitados, para que un payload hostil no cuelgue la validación. */
  MAX_PAYLOAD_NODES: 20_000,
  /** Longitud máxima de un valor string dentro del payload. Un único valor
   * de texto desmesurado pasa el resto de límites (1 propiedad, profundidad
   * 1) pero puede reventar el layout de la UI (p. ej. el diff de conflicto)
   * si se renderiza entero. Por encima del `longField` de 5000 caracteres
   * del escenario "Caso adversarial" (fixtures/scenarios.ts), que debe
   * seguir siendo una entrada válida: este límite es para lo verdaderamente
   * patológico (decenas/cientos de miles de caracteres), no para el caso
   * adversarial que la demo ya ejercita a propósito. */
  MAX_PAYLOAD_STRING_CHARS: 10_000,
  /** contracts/input.schema.json: scenarioId.maxLength */
  MAX_SCENARIO_ID_LENGTH: 80,
  /** Tamaño máximo (en caracteres) del JSON pegado en el editor de payload. */
  MAX_INPUT_TEXT_CHARS: 200_000,
  /** contracts/output.schema.json: findings.maxItems */
  MAX_FINDINGS_PER_RUN: 1000,
  /** Tope del historial de transiciones que se conserva para la línea de tiempo. */
  MAX_TRANSITIONS_HISTORY: 500,
  /** Tamaño máximo de una exportación generada (06-modelo-datos.md). */
  MAX_EXPORT_BYTES: 5 * 1024 * 1024,
  /** Presupuesto de tiempo cooperativo antes de ceder el hilo. */
  TIME_BUDGET_MS: 4000,
  /** Latencia simulada del "worker" de procesamiento, para que el estado
   * intermedio "procesando/cancelar" sea visible en la UI. */
  PROCESSING_DELAY_MS: 650,
  /** TTL por defecto para escenarios que no necesitan expirar rápido. */
  DEFAULT_TTL_MS: 24 * 60 * 60 * 1000,
  /** TTL corto, usado por escenarios pensados para demostrar expiración. */
  SHORT_TTL_MS: 5_000,
  /** Avance de reloj lógico por cada operación resuelta, para que dos
   * transiciones en la misma llamada nunca compartan timestamp. */
  CLOCK_TICK_MS: 10,
} as const;
