/**
 * Fachada del hilo principal sobre el Web Worker del motor. Expone la misma
 * forma de API que EngineRuntime (submit/cancel/advanceClock/resetScenario/
 * resetAll), pero además ofrece `onState`/`getState` para poder repintar la
 * UI cada vez que el estado cambia, venga de una respuesta de `submit` o de
 * cualquier otra operación.
 *
 * Decisión de diseño (para quien construya la UI encima): como la
 * comunicación con el worker es asíncrona por naturaleza (postMessage),
 * `advanceClock`/`resetScenario`/`resetAll` no devuelven el EngineState
 * resultante de forma síncrona aquí (a diferencia de EngineRuntime, que sí
 * puede porque vive en el mismo hilo) — devuelven `void` y el snapshot
 * actualizado llega por `onState`. Esto mantiene una única forma de
 * consumir el estado (suscripción) en vez de dos (valor de retorno en un
 * modo, callback en el otro), lo que encaja bien con
 * `useSyncExternalStore(workerClient.subscribe, workerClient.getState)` en
 * React.
 *
 * Resiliencia: si `new Worker(...)` lanza, o si `Worker` no existe en el
 * entorno (Node/vitest bajo jsdom no lo implementa), o si el worker emite un
 * evento "error" en tiempo de ejecución, se cae a una instancia de
 * EngineRuntime en el propio hilo principal con la MISMA API — es el modo
 * "si falla Worker, servir modo determinista" del runbook
 * (11-despliegue-operacion.md), y también es lo que permite que las pruebas
 * de integración corran sin un Worker real.
 */
import { EngineRuntime } from "../domain/runtime";
import { createInitialState } from "../domain/engine";
import { generateRunId } from "../domain/hash";
import { WORKER_DEGRADED_FALLBACK_MESSAGE } from "../domain/copy";
import type { EngineState, InputEnvelope, OutputEnvelope } from "../domain/types";
import type { WorkerInboundMessage, WorkerOutboundMessage } from "./protocol";

/** Envolvente de salida sintética para una solicitud que quedó registrada en
 * `pending` justo cuando el Worker falló o el cliente se destruyó: nunca
 * llegará una respuesta real del Worker para ella, así que se resuelve aquí
 * mismo en vez de dejar la promesa de `submit()` colgada para siempre. */
function buildDegradedFallbackOutput(): OutputEnvelope {
  return {
    schemaVersion: "1.0.0",
    runId: generateRunId("worker-fallback"),
    status: "failed",
    summary: WORKER_DEGRADED_FALLBACK_MESSAGE,
    findings: [{ ruleId: "WORKER_FALLBACK_FAILURE", severity: "error", message: WORKER_DEGRADED_FALLBACK_MESSAGE }],
    evidence: { rulesVersion: "1.0.0", scenarioId: "worker-fallback" },
  };
}

export interface SubmitHandle {
  requestId: string;
  promise: Promise<OutputEnvelope>;
}

export class WorkerClient {
  private worker: Worker | null = null;
  private fallbackRuntime: EngineRuntime | null = null;
  private readonly listeners = new Set<(state: EngineState) => void>();
  private readonly pending = new Map<string, (output: OutputEnvelope) => void>();
  private latestState: EngineState = createInitialState();

  constructor() {
    if (typeof Worker !== "undefined") {
      try {
        const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
        worker.addEventListener("message", (event: MessageEvent<WorkerOutboundMessage>) => {
          this.handleMessage(event.data);
        });
        worker.addEventListener("error", () => this.fallBackToInThread());
        this.worker = worker;
      } catch {
        this.worker = null;
      }
    }
    if (!this.worker) {
      this.fallbackRuntime = new EngineRuntime();
      this.latestState = this.fallbackRuntime.getState();
    }
  }

  /** Snapshot más reciente conocido del estado del motor. */
  getState(): EngineState {
    return this.latestState;
  }

  /** Se suscribe a cada snapshot nuevo del estado. Devuelve una función para
   * cancelar la suscripción (compatible con `useSyncExternalStore`). */
  onState(cb: (state: EngineState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  submit(input: InputEnvelope): SubmitHandle {
    if (this.fallbackRuntime) {
      const handle = this.fallbackRuntime.submit(input);
      void handle.promise.finally(() => this.emitState(this.fallbackRuntime!.getState()));
      // El estado puede cambiar de forma síncrona también (p. ej. una clave
      // marcada "in-progress" por una solicitud concurrente).
      this.emitState(this.fallbackRuntime.getState());
      return handle;
    }

    const requestId = crypto.randomUUID();
    const promise = new Promise<OutputEnvelope>((resolve) => {
      this.pending.set(requestId, resolve);
    });
    this.postToWorker({ type: "submit", requestId, input });
    return { requestId, promise };
  }

  cancel(requestId: string): void {
    if (this.fallbackRuntime) {
      this.fallbackRuntime.cancel(requestId);
      this.emitState(this.fallbackRuntime.getState());
      return;
    }
    this.postToWorker({ type: "cancel", requestId });
  }

  advanceClock(ms: number): void {
    if (this.fallbackRuntime) {
      this.fallbackRuntime.advanceClock(ms);
      this.emitState(this.fallbackRuntime.getState());
      return;
    }
    this.postToWorker({ type: "advanceClock", ms });
  }

  resetScenario(key: string): void {
    if (this.fallbackRuntime) {
      this.fallbackRuntime.resetScenario(key);
      this.emitState(this.fallbackRuntime.getState());
      return;
    }
    this.postToWorker({ type: "resetScenario", key });
  }

  resetAll(): void {
    if (this.fallbackRuntime) {
      this.fallbackRuntime.resetAll();
      this.emitState(this.fallbackRuntime.getState());
      return;
    }
    this.postToWorker({ type: "resetAll" });
  }

  /** Libera el Worker subyacente, si lo hay. Útil al desmontar la UI o en
   * tests que crean varias instancias. Cualquier `submit()` que siguiera
   * pendiente de respuesta del Worker se resuelve aquí como fallida en vez
   * de quedarse colgada para siempre ("Procesando…" eterno en la UI). */
  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.drainPending();
    this.listeners.clear();
  }

  private postToWorker(message: WorkerInboundMessage): void {
    this.worker?.postMessage(message);
  }

  private handleMessage(message: WorkerOutboundMessage): void {
    if (message.type === "state") {
      this.emitState(message.state);
      return;
    }
    const resolve = this.pending.get(message.requestId);
    if (resolve) {
      this.pending.delete(message.requestId);
      resolve(message.output);
    }
  }

  private emitState(state: EngineState): void {
    this.latestState = state;
    for (const listener of this.listeners) listener(state);
  }

  private fallBackToInThread(): void {
    if (this.fallbackRuntime) return; // ya estábamos en modo fallback
    this.worker?.terminate();
    this.worker = null;
    this.fallbackRuntime = new EngineRuntime(this.latestState);
    // Cualquier `submit()` que ya estuviera esperando una respuesta del
    // Worker nunca la recibirá (el Worker que la iba a procesar es justo el
    // que acaba de fallar): se resuelve aquí como fallida en vez de dejar la
    // promesa colgada para siempre. Las solicitudes NUEVAS, a partir de este
    // punto, sí se sirven con normalidad desde `fallbackRuntime`.
    this.drainPending();
    this.emitState(this.fallbackRuntime.getState());
  }

  /** Resuelve y vacía cualquier entrada de `pending`: usado cuando el Worker
   * falla o se destruye y ya no puede llegar una respuesta real para esas
   * solicitudes. */
  private drainPending(): void {
    for (const [requestId, resolve] of this.pending) {
      this.pending.delete(requestId);
      resolve(buildDegradedFallbackOutput());
    }
  }
}
