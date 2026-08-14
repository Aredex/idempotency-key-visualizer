/**
 * Envoltorio postMessage de una única instancia de EngineRuntime. A
 * diferencia de un worker "por ejecución", este worker es de larga duración:
 * el estado (registros por clave, historial de transiciones) vive aquí
 * mientras dure la sesión, exactamente como lo modela EngineRuntime.
 */
/// <reference lib="webworker" />
import { EngineRuntime } from "../domain/runtime";
import type { WorkerInboundMessage, WorkerOutboundMessage } from "./protocol";

export {};

const runtime = new EngineRuntime();

/**
 * requestId del protocolo (generado en el hilo principal) → requestId interno
 * que devuelve `EngineRuntime.submit`. Son distintos, y sin esta tabla
 * `cancel` cancelaría un id que el runtime no conoce, convirtiendo el botón
 * «Cancelar» (y la tecla Escape) en un no-op silencioso.
 */
const runtimeRequestIds = new Map<string, string>();

function post(message: WorkerOutboundMessage): void {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
}

function postState(): void {
  post({ type: "state", state: runtime.getState() });
}

self.addEventListener("message", (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;

  switch (message.type) {
    case "submit": {
      const { requestId } = message;
      const handle = runtime.submit(message.input);
      runtimeRequestIds.set(requestId, handle.requestId);
      void handle.promise.then((output) => {
        runtimeRequestIds.delete(requestId);
        post({ type: "result", requestId, output });
        postState();
      });
      // El estado puede haber cambiado de forma síncrona (p. ej. se marcó
      // una clave "in-progress") aunque la promesa aún no resuelva.
      postState();
      return;
    }
    case "cancel": {
      const runtimeRequestId = runtimeRequestIds.get(message.requestId);
      if (runtimeRequestId) {
        runtimeRequestIds.delete(message.requestId);
        runtime.cancel(runtimeRequestId);
      }
      postState();
      return;
    }
    case "advanceClock": {
      runtime.advanceClock(message.ms);
      postState();
      return;
    }
    case "resetScenario": {
      runtime.resetScenario(message.key);
      postState();
      return;
    }
    case "resetAll": {
      runtime.resetAll();
      postState();
      return;
    }
  }
});
