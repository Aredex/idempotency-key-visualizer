import type { Finding } from "../domain/types";
import { SEVERITY_LABELS } from "./labels";
import "./FindingItem.css";

const SEVERITY_VARIANT: Record<Finding["severity"], "info" | "warning" | "error" | "critical"> = {
  info: "info",
  warning: "warning",
  error: "error",
  critical: "critical",
};

const SEVERITY_ICON: Record<Finding["severity"], string> = {
  info: "ℹ",
  warning: "▲",
  error: "✕",
  critical: "‼",
};

interface FindingItemProps {
  finding: Finding;
}

export function FindingItem({ finding }: FindingItemProps) {
  return (
    <li className="finding-item">
      <div className="finding-item-head">
        <span className={`badge badge-${SEVERITY_VARIANT[finding.severity]}`}>
          <span aria-hidden="true">{SEVERITY_ICON[finding.severity]}</span> {SEVERITY_LABELS[finding.severity]}
        </span>
        <span className="finding-item-rule mono">{finding.ruleId}</span>
      </div>
      <p className="finding-item-message">{finding.message}</p>
      {finding.evidencePath && (
        <p className="finding-item-evidence mono">evidencePath: {finding.evidencePath}</p>
      )}
      {finding.suggestion && <p className="finding-item-suggestion">Sugerencia: {finding.suggestion}</p>}
    </li>
  );
}
