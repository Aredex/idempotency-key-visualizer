/**
 * Editor de payload: textarea mono con contador de caracteres/bytes,
 * contador informativo de propiedades de nivel superior, y error inline
 * (nunca solo un toast) cuando `parsePayloadText` lanza. La comprobación de
 * propiedades aquí es solo una pista de UI — el límite real lo aplica el
 * motor (ver LIMITS.MAX_PAYLOAD_PROPERTIES y el Finding correspondiente).
 */
import { forwardRef } from "react";
import { LIMITS } from "../domain/limits";
import { formatNumber } from "./labels";
import "./PayloadEditor.css";

export interface PayloadEditorProps {
  value: string;
  onChange: (text: string) => void;
  stateLabel: string;
  isInvalid: boolean;
  errorMessage?: string;
  propertyCount?: number;
}

export const PayloadEditor = forwardRef<HTMLDivElement, PayloadEditorProps>(function PayloadEditor(
  { value, onChange, stateLabel, isInvalid, errorMessage, propertyCount },
  errorSummaryRef
) {
  const charCount = value.length;
  const byteCount = new TextEncoder().encode(value).length;
  const overCharLimit = charCount > LIMITS.MAX_INPUT_TEXT_CHARS;
  const overPropertyHint = propertyCount !== undefined && propertyCount > LIMITS.MAX_PAYLOAD_PROPERTIES;

  const describedBy = ["payload-counters", isInvalid ? "payload-error" : null].filter(Boolean).join(" ");

  return (
    <div className="payload-editor" id="payload-editor-panel" role="tabpanel">
      <div className="payload-editor-head">
        <label htmlFor="payload-editor-textarea">Payload (JSON)</label>
        <span className={`badge ${isInvalid ? "badge-error" : "badge-neutral"}`}>{stateLabel}</span>
      </div>

      {isInvalid && errorMessage && (
        <div id="payload-error" className="payload-error" role="alert" tabIndex={-1} ref={errorSummaryRef}>
          <p className="payload-error-title">
            No pudimos procesar esta entrada. Tus datos no se enviaron; corrige los campos señalados.
          </p>
          <p className="payload-error-detail mono">{errorMessage}</p>
        </div>
      )}

      <textarea
        id="payload-editor-textarea"
        className="payload-textarea mono"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-invalid={isInvalid}
        aria-describedby={describedBy || undefined}
        rows={16}
      />

      <div id="payload-counters" className="payload-counters">
        <span className={overCharLimit ? "payload-counter payload-counter--over" : "payload-counter"}>
          {formatNumber(charCount)} / {formatNumber(LIMITS.MAX_INPUT_TEXT_CHARS)} caracteres ·{" "}
          {formatNumber(byteCount)} bytes
        </span>
        <span className={overPropertyHint ? "payload-counter payload-counter--over" : "payload-counter"}>
          {propertyCount !== undefined ? formatNumber(propertyCount) : "—"} /{" "}
          {formatNumber(LIMITS.MAX_PAYLOAD_PROPERTIES)} propiedades de nivel superior
        </span>
      </div>
      <p className="field-hint">
        El contador de propiedades es solo una pista informativa del cliente; el límite real lo
        comprueba el motor y aparece como hallazgo si se supera.
      </p>
    </div>
  );
});
