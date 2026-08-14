import type { EngineState, InputEnvelope, OutputEnvelope } from "../domain/types";

/** Mensajes del hilo principal hacia el worker. */
export type WorkerInboundMessage =
  | { type: "submit"; requestId: string; input: InputEnvelope }
  | { type: "cancel"; requestId: string }
  | { type: "advanceClock"; ms: number }
  | { type: "resetScenario"; key: string }
  | { type: "resetAll" };

/** Mensajes del worker hacia el hilo principal. `state` se emite después de
 * cada operación que puede haber cambiado el EngineState, para que la UI
 * pueda repintar la línea de tiempo sin tener que esperar a que resuelva
 * cada promesa individual de `submit`. */
export type WorkerOutboundMessage =
  | { type: "result"; requestId: string; output: OutputEnvelope }
  | { type: "state"; state: EngineState };
