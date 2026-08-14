/**
 * Controles de ejecución: ejecutar / cancelar / simular concurrencia /
 * avanzar reloj / reiniciar escenario / eliminar datos locales. El botón de
 * "cruzar TTL" solo se muestra para escenarios con TTL corto (<=60s): cruzar
 * un TTL de 24h con un botón no tendría sentido práctico en una demo.
 */
import type { ScenarioFixture } from "../domain/types";
import "./ExecuteControls.css";

const SHORT_TTL_THRESHOLD_MS = 60_000;

interface ExecuteControlsProps {
  isPending: boolean;
  executionStateLabel: string;
  scenario: ScenarioFixture;
  onExecute: () => void;
  onCancel: () => void;
  onConcurrent: () => void;
  onAdvanceClock: (ms: number) => void;
  onResetScenario: () => void;
  onResetAll: () => void;
}

export function ExecuteControls({
  isPending,
  executionStateLabel,
  scenario,
  onExecute,
  onCancel,
  onConcurrent,
  onAdvanceClock,
  onResetScenario,
  onResetAll,
}: ExecuteControlsProps) {
  const canDemoExpiry = scenario.ttlMs <= SHORT_TTL_THRESHOLD_MS;
  const crossTtlSeconds = Math.ceil((scenario.ttlMs + 1000) / 1000);

  return (
    <div className="execute-controls">
      <div className="execute-controls-status">
        <span className="field-hint">Ejecución</span>
        <span className="badge badge-info">{executionStateLabel}</span>
      </div>

      <div className="execute-controls-row">
        <button type="button" className="btn btn-primary" onClick={onExecute} disabled={isPending}>
          Ejecutar escenario
        </button>
        {isPending && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onConcurrent} disabled={isPending}>
          Simular petición concurrente
        </button>
      </div>

      <div className="execute-controls-row execute-controls-row--clock">
        <button type="button" className="btn btn-secondary" onClick={() => onAdvanceClock(1000)}>
          +1 s
        </button>
        {canDemoExpiry ? (
          <button type="button" className="btn btn-secondary" onClick={() => onAdvanceClock(scenario.ttlMs + 1000)}>
            +{crossTtlSeconds} s (expira la clave)
          </button>
        ) : (
          <span className="field-hint">
            TTL de este escenario: {Math.round(scenario.ttlMs / 3_600_000)} h. Usa «Reservar inventario»
            para demostrar expiración rápidamente.
          </span>
        )}
      </div>

      <div className="execute-controls-row">
        <button type="button" className="btn-quiet" onClick={onResetScenario}>
          Reiniciar escenario
        </button>
      </div>

      <div className="execute-controls-danger">
        <button type="button" className="btn btn-danger-quiet" onClick={onResetAll}>
          Eliminar datos locales
        </button>
        <p className="field-hint">
          Borra todo el historial de esta demo (registros y línea de tiempo) en tu navegador. No hay
          nada que borrar en ningún servidor porque nada salió de aquí.
        </p>
      </div>
    </div>
  );
}
