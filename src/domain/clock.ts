/**
 * Helpers puros sobre el reloj lógico de EngineState.clockMs. El motor nunca
 * lee Date.now()/performance.now() para decidir nada — todo el tiempo que
 * importa para la simulación es este reloj, avanzado explícitamente por
 * EngineRuntime (temporizadores reales) o por advanceClock (control manual
 * desde la UI).
 */
import type { EngineState, RecordState } from "./types";
import { LIMITS } from "./limits";

/** Devuelve un EngineState nuevo con el reloj avanzado `ms` milisegundos. */
export function tick(state: EngineState, ms: number = LIMITS.CLOCK_TICK_MS): EngineState {
  return { ...state, clockMs: state.clockMs + ms };
}

/** Un registro completado ha expirado si el reloj ya alcanzó su expiresAtMs. */
export function isExpired(record: RecordState, nowMs: number): boolean {
  return record.status === "completed" && nowMs >= (record.expiresAtMs ?? Infinity);
}
