/**
 * Puente entre React y el `WorkerClient` del motor. Instancia el cliente UNA
 * sola vez a nivel de módulo (nunca dentro del componente) para que
 * remontajes/re-renders nunca creen un segundo Worker — ver el comentario de
 * diseño en src/worker/workerClient.ts sobre `useSyncExternalStore`.
 */
import { useCallback, useSyncExternalStore } from "react";
import { WorkerClient } from "../worker/workerClient";
import type { EngineState, InputEnvelope } from "../domain/types";

const client = new WorkerClient();

function subscribe(cb: () => void): () => void {
  return client.onState(() => cb());
}

function getSnapshot(): EngineState {
  return client.getState();
}

export interface EngineClient {
  state: EngineState;
  client: WorkerClient;
  submit: (input: InputEnvelope) => ReturnType<WorkerClient["submit"]>;
  cancel: (requestId: string) => void;
  advanceClock: (ms: number) => void;
  resetScenario: (key: string) => void;
  resetAll: () => void;
}

export function useEngineClient(): EngineClient {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const submit = useCallback((input: InputEnvelope) => client.submit(input), []);
  const cancel = useCallback((requestId: string) => client.cancel(requestId), []);
  const advanceClock = useCallback((ms: number) => client.advanceClock(ms), []);
  const resetScenario = useCallback((key: string) => client.resetScenario(key), []);
  const resetAll = useCallback(() => client.resetAll(), []);

  return { state, client, submit, cancel, advanceClock, resetScenario, resetAll };
}
