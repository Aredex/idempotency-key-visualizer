/**
 * Una entrada expandible de la línea de tiempo de "Decisiones". Nunca
 * representa la confianza solo con color: siempre lleva su etiqueta de
 * texto ("Confianza: alta/media/baja").
 */
import type { Transition } from "../domain/types";
import { CONFIDENCE_LABELS, DECISION_LABELS } from "./labels";
import "./TransitionCard.css";

const CONFIDENCE_VARIANT: Record<Transition["confidence"], "info" | "warning" | "error"> = {
  high: "info",
  medium: "warning",
  low: "error",
};

interface TransitionCardProps {
  transition: Transition;
  defaultOpen?: boolean;
}

export function TransitionCard({ transition, defaultOpen }: TransitionCardProps) {
  return (
    <details className="expandable transition-card" open={defaultOpen}>
      <summary>
        <span className="transition-card-kind">{DECISION_LABELS[transition.kind]}</span>
        <span className={`badge badge-${CONFIDENCE_VARIANT[transition.confidence]}`}>
          {CONFIDENCE_LABELS[transition.confidence]}
        </span>
      </summary>
      <div className="expandable-body">
        <p className="transition-card-explanation">{transition.explanation}</p>
        {transition.assumptions.length > 0 && (
          <>
            <p className="transition-card-label">Supuestos</p>
            <ul className="transition-card-assumptions">
              {transition.assumptions.map((assumption, index) => (
                <li key={index}>{assumption}</li>
              ))}
            </ul>
          </>
        )}
        <p className="transition-card-meta mono">
          {transition.from} → {transition.to} · t={transition.atMs}ms
        </p>
      </div>
    </details>
  );
}
