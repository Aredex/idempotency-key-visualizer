import "./DeterministicToggle.css";

interface DeterministicToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function DeterministicToggle({ checked, onChange }: DeterministicToggleProps) {
  return (
    <div className="deterministic-toggle">
      <div className="checkbox-row">
        <input
          type="checkbox"
          id="deterministic-toggle"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <label htmlFor="deterministic-toggle">Modo determinista (recomendado)</label>
      </div>
      <p className="field-hint">
        Desactívalo para pedir el adaptador «real» (no determinista). El adaptador real está
        permanentemente deshabilitado en este despliegue, así que ninguna llamada de red sale de tu
        navegador: solo verás el hallazgo de fallback que demuestra cómo se degrada una integración real
        cuando su dependencia externa no está disponible.
      </p>
    </div>
  );
}
