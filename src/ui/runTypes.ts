import type { OutputEnvelope } from "../domain/types";

/**
 * Una ejecución iniciada desde la UI. Deliberadamente NO guarda las
 * `Transition` correlacionadas en el momento de resolverse: las deriva en
 * cada render filtrando `state.transitions` por `output.runId` (igual que
 * hace exportReport.ts). Snapshotearlas una sola vez al resolver la promesa
 * sería una condición de carrera real con el WorkerClient basado en Worker:
 * el mensaje "result" (que resuelve la promesa) puede llegar antes que el
 * mensaje "state" que trae esas transiciones al store de React.
 */
export interface RunEntry {
  id: string;
  label: string;
  scenarioId: string;
  key: string;
  submittedPayload: Record<string, unknown>;
  status: "pending" | "resolved";
  output?: OutputEnvelope;
}
