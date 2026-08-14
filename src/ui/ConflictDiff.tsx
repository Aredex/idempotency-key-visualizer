/**
 * Diff estructural (solo nombres de clave de nivel superior, nunca valores
 * anidados) entre el payload guardado y el enviado. Debe poder entenderse
 * sin depender del color (WCAG): la lista es texto plano con signos +/-/≠.
 *
 * Todo el contenido del payload (incluido el adversarial) se renderiza como
 * texto JSX plano — nunca innerHTML — así que un `<script>` en el payload
 * aparece literalmente como texto, nunca se ejecuta.
 */
import { useId } from "react";
import { diffTopLevelKeys } from "../domain/rules";
import "./ConflictDiff.css";

interface ConflictDiffProps {
  storedPayload: Record<string, unknown>;
  submittedPayload: Record<string, unknown>;
}

export function ConflictDiff({ storedPayload, submittedPayload }: ConflictDiffProps) {
  const diff = diffTopLevelKeys(storedPayload, submittedPayload);
  const hasDiff = diff.differing.length + diff.onlyInIncoming.length + diff.onlyInStored.length > 0;
  // Puede haber varias tarjetas de ejecución con conflicto visibles a la vez
  // (una por cada "Ejecutar escenario" que provocó un conflicto), así que un
  // `id` fijo colisionaría; `useId` da un prefijo único por instancia.
  const idPrefix = useId();
  const storedLabelId = `${idPrefix}-stored`;
  const submittedLabelId = `${idPrefix}-submitted`;

  return (
    <div className="conflict-diff">
      <p className="transition-card-label">Diferencia estructural (solo claves de nivel superior)</p>
      {hasDiff ? (
        <ul className="conflict-diff-list">
          {diff.differing.map((key) => (
            <li key={`diff-${key}`}>
              <span className="mono">{key}</span>: {formatValue(storedPayload[key])} →{" "}
              {formatValue(submittedPayload[key])} <span className="conflict-diff-tag">(valor distinto)</span>
            </li>
          ))}
          {diff.onlyInIncoming.map((key) => (
            <li key={`new-${key}`}>
              <span className="mono">{key}</span> <span className="conflict-diff-tag">(clave nueva)</span>
            </li>
          ))}
          {diff.onlyInStored.map((key) => (
            <li key={`missing-${key}`}>
              <span className="mono">{key}</span> <span className="conflict-diff-tag">(clave ausente)</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="field-hint">
          Las claves de nivel superior coinciden; la diferencia está en un nivel más profundo del
          payload (la huella lo detecta igualmente).
        </p>
      )}

      <div className="conflict-diff-panels">
        <div>
          <p className="transition-card-label" id={storedLabelId}>
            Guardado originalmente
          </p>
          {/* tabIndex: este `<pre>` puede desplazarse horizontalmente (ver
              CSS `min-width: 0` en .conflict-diff-panels > div) cuando el
              JSON contiene una línea más ancha que la columna — sin esto,
              ese scroll quedaría inalcanzable por teclado (WCAG 2.1.1). */}
          <pre className="evidence-block" tabIndex={0} aria-labelledby={storedLabelId}>
            {JSON.stringify(storedPayload, null, 2)}
          </pre>
        </div>
        <div>
          <p className="transition-card-label" id={submittedLabelId}>
            Enviado ahora
          </p>
          <pre className="evidence-block" tabIndex={0} aria-labelledby={submittedLabelId}>
            {JSON.stringify(submittedPayload, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}

/** Longitud máxima de un valor formateado en la línea del diff. Es un límite
 * solo de presentación (defensa en profundidad de layout, ver también
 * `src/domain/limits.ts#MAX_PAYLOAD_STRING_CHARS` y CSS `overflow-wrap`): no
 * afecta al valor real, que sigue completo en `storedPayload`/
 * `submittedPayload` (usados por los paneles "Guardado originalmente" /
 * "Enviado ahora" de abajo y por la exportación). */
const MAX_DISPLAY_VALUE_CHARS = 200;

function formatValue(value: unknown): string {
  if (value === undefined) return "(ausente)";
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  if (text.length <= MAX_DISPLAY_VALUE_CHARS) return text;
  return `${text.slice(0, MAX_DISPLAY_VALUE_CHARS)}…`;
}
