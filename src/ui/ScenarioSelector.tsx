/**
 * Selector de escenario: tabs sobre SCENARIOS + dos atajos de un clic
 * (entrada inválida de demo). Los escenarios "boundary"/"adversarial" no
 * necesitan mecanismo propio: son tabs normales, ya vienen en SCENARIOS.
 */
import { SCENARIOS } from "../domain/fixtures/scenarios";
import type { ScenarioFixture } from "../domain/types";
import "./ScenarioSelector.css";

const TAG_LABELS: Record<ScenarioFixture["tags"][number], string> = {
  preset: "Preset",
  boundary: "Caso límite",
  adversarial: "Adversarial",
};

interface ScenarioSelectorProps {
  activeId: string;
  onSelect: (scenario: ScenarioFixture) => void;
  onLoadInvalidDemo: () => void;
}

export function ScenarioSelector({ activeId, onSelect, onLoadInvalidDemo }: ScenarioSelectorProps) {
  return (
    <div className="scenario-selector">
      <div className="scenario-selector-head">
        <label id="scenario-selector-label">Escenario</label>
        <p className="field-hint">
          Elige un punto de partida. Al cambiar de escenario se recarga su payload de ejemplo.
        </p>
      </div>
      <div className="scenario-tabs" role="tablist" aria-labelledby="scenario-selector-label">
        {SCENARIOS.map((scenario) => {
          const selected = scenario.id === activeId;
          return (
            <button
              key={scenario.id}
              type="button"
              role="tab"
              id={`scenario-tab-${scenario.id}`}
              aria-selected={selected}
              aria-controls="payload-editor-panel"
              className={`scenario-tab${selected ? " scenario-tab--active" : ""}`}
              onClick={() => onSelect(scenario)}
            >
              <span className="scenario-tab-title">{scenario.title}</span>
              <span className="scenario-tab-tags">
                {scenario.tags.map((tag) => (
                  <span key={tag} className="badge badge-neutral">
                    {TAG_LABELS[tag]}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="scenario-description" aria-live="off">
        {SCENARIOS.find((s) => s.id === activeId)?.description}
      </p>
      <button type="button" className="btn-quiet scenario-invalid-demo" onClick={onLoadInvalidDemo}>
        Cargar entrada inválida (demo)
      </button>
    </div>
  );
}
