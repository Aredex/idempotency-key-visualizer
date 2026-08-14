import type { EngineState, Transition } from "../domain/types";
import type { RunEntry } from "./runTypes";
import { RunCard } from "./RunCard";
import { TransitionCard } from "./TransitionCard";
import { ExportPanel } from "./ExportPanel";
import "./ResultPanel.css";

interface ResultPanelProps {
  runs: RunEntry[];
  clockEvents: Transition[];
  state: EngineState;
  activeKey: string;
  announceMessage: string;
}

export function ResultPanel({ runs, clockEvents, state, activeKey, announceMessage }: ResultPanelProps) {
  const hasResolved = runs.some((run) => run.status === "resolved");
  const resolvedCount = runs.filter((run) => run.status === "resolved").length;

  return (
    <>
      <h2 id="resultado-heading">Resultado</h2>

      <p className="result-index field-hint">
        {runs.length === 0
          ? "0 ejecuciones registradas todavía."
          : `${resolvedCount} de ${runs.length} ejecuciones recientes resueltas.`}
      </p>

      <div aria-live="polite" className="visually-hidden">
        {announceMessage}
      </div>

      {runs.length === 0 && (
        <p className="result-empty-state">Aún no hay resultado. Ejecuta el fixture para ver cada decisión.</p>
      )}

      {runs.length > 0 && !hasResolved && (
        <p className="field-hint" aria-hidden="true">
          Procesando la ejecución…
        </p>
      )}

      {hasResolved && (
        <p className="result-lead">La ejecución terminó. Abre cada decisión para revisar su evidencia.</p>
      )}

      {clockEvents.length > 0 && (
        <div className="result-clock-events">
          <h3 className="run-card-section-title">Eventos del reloj</h3>
          <div className="run-card-transitions">
            {clockEvents.map((transition) => (
              <TransitionCard key={transition.id} transition={transition} />
            ))}
          </div>
        </div>
      )}

      {runs.length > 0 && (
        <div className="result-runs">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} state={state} />
          ))}
        </div>
      )}

      <ExportPanel state={state} activeKey={activeKey} />
    </>
  );
}
