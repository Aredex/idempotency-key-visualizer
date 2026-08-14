/**
 * `EngineRuntime`: única capa con estado/async/temporizadores del dominio.
 * Envuelve al motor puro (engine.ts) y es lo que hace reales la concurrencia
 * y la cancelación: posee el reloj de temporizadores real (`setTimeout`),
 * el registro de claves "en vuelo" y el mapa de temporizadores pendientes
 * por requestId. Tanto el Web Worker (worker/engine.worker.ts) como el
 * fallback en el hilo principal (worker/workerClient.ts) envuelven la misma
 * clase, así que el comportamiento es idéntico se ejecute donde se ejecute.
 */
import { LIMITS } from "./limits";
import { fingerprint, generateRunId } from "./hash";
import { validateInputEnvelope } from "./envelope";
import { CANCELLED_MESSAGE } from "./copy";
import {
  appendTransitions,
  applyOperation,
  advanceClock as engineAdvanceClock,
  createInitialState,
  resetAll as engineResetAll,
  resetScenario as engineResetScenario,
  resolveKeyAndTtl,
} from "./engine";
import type { EngineState, InputEnvelope, OutputEnvelope, RecordState, Transition } from "./types";

export interface SubmitHandle {
  requestId: string;
  promise: Promise<OutputEnvelope>;
}

interface PendingEntry {
  key: string;
  timer: ReturnType<typeof setTimeout>;
  resolve: (output: OutputEnvelope) => void;
}

export class EngineRuntime {
  private state: EngineState;
  /** Claves con una solicitud "en vuelo" (temporizador pendiente). Se
   * comprueba de forma síncrona en `submit`, por eso una segunda llamada
   * en el mismo tick ya la ve. */
  private inFlightKeys = new Set<string>();
  private pendingTimers = new Map<string, PendingEntry>();

  constructor(initialState: EngineState = createInitialState()) {
    this.state = initialState;
  }

  /** Snapshot de solo lectura para la línea de tiempo / exportación de la
   * UI. Como el estado nunca se muta in situ (siempre se reasigna
   * `this.state`), es seguro entregarlo directamente a React. */
  getState(): EngineState {
    return this.state;
  }

  submit(input: InputEnvelope): SubmitHandle {
    const requestId = crypto.randomUUID();

    let validated: InputEnvelope | undefined;
    try {
      validated = validateInputEnvelope(input);
    } catch {
      validated = undefined;
    }

    if (!validated) {
      // Entrada inválida: no hay clave que bloquear ni motivo para simular
      // latencia de red por algo que ni siquiera pasa la validación.
      const promise = this.runFastPath(input);
      return { requestId, promise };
    }

    const { key } = resolveKeyAndTtl(validated);

    if (this.inFlightKeys.has(key)) {
      const promise = this.runConcurrentPath(key, validated);
      return { requestId, promise };
    }

    this.inFlightKeys.add(key);
    const promise = new Promise<OutputEnvelope>((resolve) => {
      const timer = setTimeout(() => {
        void this.resolveTimer(requestId, key, validated, resolve);
      }, LIMITS.PROCESSING_DELAY_MS);
      this.pendingTimers.set(requestId, { key, timer, resolve });
    });

    return { requestId, promise };
  }

  cancel(requestId: string): void {
    const entry = this.pendingTimers.get(requestId);
    if (!entry) return; // ya resuelta (o nunca existió): no-op, nunca rechaza

    clearTimeout(entry.timer);
    this.pendingTimers.delete(requestId);
    this.inFlightKeys.delete(entry.key);

    const priorRecord: RecordState | undefined = this.state.records[entry.key];
    const runId = generateRunId(entry.key);
    const output: OutputEnvelope = {
      schemaVersion: "1.0.0",
      runId,
      status: "cancelled",
      summary: CANCELLED_MESSAGE,
      findings: [{ ruleId: "RUN_CANCELLED", severity: "info", message: CANCELLED_MESSAGE }],
      evidence: { rulesVersion: "1.0.0", scenarioId: entry.key },
    };
    const transition: Transition = {
      id: crypto.randomUUID(),
      runId,
      kind: "cancelled",
      atMs: this.state.clockMs,
      from: priorRecord?.status ?? "none",
      to: priorRecord?.status ?? "absent",
      explanation: CANCELLED_MESSAGE,
      assumptions: [],
      confidence: "high",
    };
    this.state = { ...this.state, transitions: appendTransitions(this.state.transitions, [transition]) };

    entry.resolve(output); // se RESUELVE, nunca se rechaza — status:"cancelled" es un resultado válido
  }

  advanceClock(ms: number): EngineState {
    this.state = engineAdvanceClock(this.state, ms);
    return this.state;
  }

  resetScenario(key: string): EngineState {
    // Una solicitud en vuelo para esta clave (temporizador pendiente) no
    // puede sobrevivir al reinicio del escenario: si se dejara resolver más
    // tarde, recrearía en silencio el registro que el visitante acaba de
    // borrar. Se cancela aquí, igual que hace `cancel()` para una solicitud
    // cancelada explícitamente.
    this.cancelPendingForKey(key);
    this.state = engineResetScenario(this.state, key);
    return this.state;
  }

  resetAll(): EngineState {
    // Igual que en resetScenario, pero para todas las claves: ninguna
    // solicitud en vuelo puede sobrevivir a "Eliminar datos locales", o
    // resolvería después del borrado y recrearía un registro para una clave
    // que el visitante acaba de vaciar.
    for (const key of new Set(this.inFlightKeys)) this.cancelPendingForKey(key);
    this.state = engineResetAll(this.state);
    return this.state;
  }

  /** Cancela (resuelve como "cancelled") y limpia cualquier temporizador
   * pendiente para `key`, y libera su marca de "en vuelo". Usado por
   * `resetScenario`/`resetAll` para que un reinicio no deje residuos de una
   * solicitud que seguía procesándose. No añade una transición al historial
   * (a diferencia de `cancel()`): el propio reinicio ya es la operación que
   * el visitante ve, y en el caso de `resetAll` el historial completo se
   * borra de todos modos. */
  private cancelPendingForKey(key: string): void {
    this.inFlightKeys.delete(key);
    for (const [requestId, entry] of this.pendingTimers) {
      if (entry.key !== key) continue;
      clearTimeout(entry.timer);
      this.pendingTimers.delete(requestId);
      const output: OutputEnvelope = {
        schemaVersion: "1.0.0",
        runId: generateRunId(key),
        status: "cancelled",
        summary: CANCELLED_MESSAGE,
        findings: [{ ruleId: "RUN_CANCELLED", severity: "info", message: CANCELLED_MESSAGE }],
        evidence: { rulesVersion: "1.0.0", scenarioId: key },
      };
      entry.resolve(output);
    }
  }

  private async runFastPath(input: InputEnvelope): Promise<OutputEnvelope> {
    const rawPayload =
      typeof input === "object" && input !== null && "payload" in input
        ? (input as { payload?: unknown }).payload
        : undefined;
    const fp = await fingerprint(rawPayload ?? {});
    const { state: nextState, output } = applyOperation(this.state, input, fp);
    this.state = nextState;
    return output;
  }

  private async runConcurrentPath(key: string, validated: InputEnvelope): Promise<OutputEnvelope> {
    // La solicitud original todavía no ha tocado el registro (su temporizador
    // no ha disparado), así que lo marcamos "in-progress" aquí mismo, solo
    // para que la rama de guarda de concurrencia de applyOperation (paso 5)
    // se active. Ver el comentario equivalente en engine.ts.
    //
    // Importante: si la clave ya tenía un registro `completed` (p. ej. el
    // visitante ya ejecutó el escenario y ahora dispara "Simular petición
    // concurrente" sobre esa misma clave), NO se puede descartar ese registro
    // — su `fingerprint`/`storedOutput`/`storedPayload`/`expiresAtMs` deben
    // seguir disponibles cuando `resolveTimer` los necesite para decidir
    // retry-hit/conflict en vez de una falsa primera ejecución. Por eso se
    // conserva el registro previo bajo el centinela "in-progress" en lugar de
    // sustituirlo por uno vacío.
    if (this.state.records[key]?.status !== "in-progress") {
      const prior = this.state.records[key];
      this.state = {
        ...this.state,
        records: { ...this.state.records, [key]: { ...(prior ?? { key }), key, status: "in-progress" } },
      };
    }
    const fp = await fingerprint(validated.payload);
    const { state: nextState, output } = applyOperation(this.state, validated, fp);
    this.state = nextState;
    return output;
  }

  private async resolveTimer(
    requestId: string,
    key: string,
    validated: InputEnvelope,
    resolve: (output: OutputEnvelope) => void
  ): Promise<void> {
    this.inFlightKeys.delete(key);
    this.pendingTimers.delete(requestId);

    // Si una solicitud concurrente marcó esta clave como "in-progress"
    // mientras esperábamos (ver runConcurrentPath), la restauramos aquí:
    // esta es la solicitud propietaria del lock terminando de verdad, no
    // otra guarda de concurrencia. Si el centinela llevaba un registro
    // `completed` preservado debajo (ver runConcurrentPath), se restaura tal
    // cual para que applyOperation pueda decidir retry-hit/conflict contra
    // el resultado realmente guardado. Si no llevaba nada (clave nueva, caso
    // legítimo de guarda de concurrencia de siempre), se borra y la solicitud
    // completa como primera ejecución, exactamente como antes.
    const marked = this.state.records[key];
    if (marked?.status === "in-progress") {
      const nextRecords = { ...this.state.records };
      if (marked.storedOutput) {
        nextRecords[key] = { ...marked, status: "completed" };
      } else {
        delete nextRecords[key];
      }
      this.state = { ...this.state, records: nextRecords };
    }

    const fp = await fingerprint(validated.payload);
    const { state: nextState, output } = applyOperation(this.state, validated, fp);
    this.state = nextState;
    resolve(output);
  }
}
