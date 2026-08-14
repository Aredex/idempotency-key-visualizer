/**
 * Exportación del reporte de una clave a Markdown o JSON. Las llamadas de
 * dominio son síncronas y rápidas, pero igualmente se modela un estado
 * "generando" breve (requisito de producto) y un estado de fallo recuperable
 * con reintento si `buildExportReport`/`toJson`/`toMarkdown` lanzan
 * (LIMIT_EXCEEDED si el reporte supera el presupuesto de exportación).
 */
import { useState } from "react";
import { buildExportReport, toJson, toMarkdown } from "../domain/exportReport";
import { EngineError } from "../domain/types";
import type { EngineState } from "../domain/types";
import "./ExportPanel.css";

type ExportFormat = "json" | "markdown";
type ExportPhase = "idle" | "generating" | "error";

interface ExportPanelProps {
  state: EngineState;
  activeKey: string;
}

export function ExportPanel({ state, activeKey }: ExportPanelProps) {
  const [includePayload, setIncludePayload] = useState(false);
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFormat, setLastFormat] = useState<ExportFormat | null>(null);

  const record = state.records[activeKey];
  const canExport = record?.storedOutput !== undefined;

  async function runExport(format: ExportFormat) {
    setLastFormat(format);
    setPhase("generating");
    setErrorMessage(null);
    // Pequeña espera artificial: las llamadas de dominio son síncronas y
    // casi instantáneas, pero el estado "generando" debe poder observarse.
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      const report = buildExportReport(state, activeKey, { includePayload });
      const content = format === "json" ? toJson(report) : toMarkdown(report);
      const blob = new Blob([content], {
        type: format === "json" ? "application/json" : "text/markdown",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `idempotency-report-${activeKey}.${format === "json" ? "json" : "md"}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setPhase("idle");
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof EngineError ? err.message : "No se pudo generar la exportación.");
    }
  }

  return (
    <div className="export-panel">
      <h4 className="run-card-section-title">Exportar</h4>
      <div className="checkbox-row">
        <input
          type="checkbox"
          id="export-include-payload"
          checked={includePayload}
          onChange={(event) => setIncludePayload(event.target.checked)}
        />
        <label htmlFor="export-include-payload">Incluir payload de ejemplo (redactado)</label>
      </div>

      <p className="field-hint">
        Exporta el resultado <strong>guardado</strong> de esta clave (no la última ejecución
        rechazada, si la hubo).
      </p>

      <div className="export-panel-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void runExport("markdown")}
          disabled={!canExport || phase === "generating"}
        >
          Exportar Markdown
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void runExport("json")}
          disabled={!canExport || phase === "generating"}
        >
          Exportar JSON
        </button>
        {phase === "generating" && <span className="field-hint">Generando…</span>}
      </div>

      {!canExport && (
        <p className="field-hint">Ejecuta el escenario para poder exportar un reporte de esta clave.</p>
      )}

      {phase === "error" && errorMessage && (
        <div className="export-panel-error" role="alert">
          <p>No se pudo generar la exportación: {errorMessage}</p>
          <button
            type="button"
            className="btn-quiet"
            onClick={() => lastFormat && void runExport(lastFormat)}
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
