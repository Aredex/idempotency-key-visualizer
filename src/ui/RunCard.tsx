import type { EngineState } from "../domain/types";
import type { RunEntry } from "./runTypes";
import { RESULT_CATEGORY_LABELS, RESULT_CATEGORY_VARIANT, STATUS_BADGE_VARIANT, STATUS_LABELS, resultCategory } from "./labels";
import { TransitionCard } from "./TransitionCard";
import { FindingItem } from "./FindingItem";
import { ConflictDiff } from "./ConflictDiff";
import "./RunCard.css";

interface RunCardProps {
  run: RunEntry;
  state: EngineState;
}

export function RunCard({ run, state }: RunCardProps) {
  if (run.status === "pending" || !run.output) {
    return (
      <article className="card run-card run-card--pending" aria-busy="true">
        <div className="run-card-head">
          <h3 className="run-card-title">{run.label}</h3>
          <span className="badge badge-neutral run-card-processing">Procesando…</span>
        </div>
        <p className="field-hint">Esperando la resolución simulada de esta solicitud.</p>
      </article>
    );
  }

  const { output } = run;
  const transitions = state.transitions.filter((t) => t.runId === output.runId);
  const category = resultCategory(output.status, output.findings);
  const lastTransition = transitions[transitions.length - 1];
  const showConflictDiff = lastTransition?.kind === "conflict";
  const storedPayload = state.records[run.key]?.storedPayload;

  return (
    <article className="card run-card">
      <div className="run-card-head">
        <h3 className="run-card-title">{run.label}</h3>
        <div className="run-card-badges">
          <span className={`badge badge-${STATUS_BADGE_VARIANT[output.status]}`}>
            {STATUS_LABELS[output.status]}
          </span>
          <span className={`badge badge-${RESULT_CATEGORY_VARIANT[category]}`}>
            {RESULT_CATEGORY_LABELS[category]}
          </span>
        </div>
      </div>

      <p className="run-card-summary">{output.summary}</p>
      <p className="run-card-meta mono">
        runId: {output.runId} · clave: {run.key}
      </p>

      {transitions.length > 0 && (
        <div className="run-card-section">
          <h4 className="run-card-section-title">Decisiones</h4>
          <div className="run-card-transitions">
            {transitions.map((transition, index) => (
              <TransitionCard key={transition.id} transition={transition} defaultOpen={index === transitions.length - 1} />
            ))}
          </div>
        </div>
      )}

      {showConflictDiff && storedPayload && (
        <div className="run-card-section">
          <h4 className="run-card-section-title">Comparación del payload</h4>
          <ConflictDiff storedPayload={storedPayload} submittedPayload={run.submittedPayload} />
        </div>
      )}

      {output.findings.length > 0 && (
        <div className="run-card-section">
          <h4 className="run-card-section-title">Hallazgos</h4>
          <ul className="run-card-findings">
            {output.findings.map((finding, index) => (
              <FindingItem key={`${finding.ruleId}-${index}`} finding={finding} />
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
