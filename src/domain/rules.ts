/**
 * Una función por tipo de decisión del motor. Cada una es pura: no lee
 * estado global ni reloj, solo construye la explicación, los findings y la
 * lista de supuestos ("assumptions") a partir de lo que engine.ts ya sabe.
 * Ver 08-seguridad-privacidad.md y copy.ts para las restricciones de
 * lenguaje (nunca prometer garantías que este simulador no puede dar).
 */
import type { Confidence, DecisionKind, Finding, Severity } from "./types";
import {
  CONCURRENT_GUARD_EXPLANATION,
  CONFLICT_EXPLANATION,
  DEPENDENCY_FALLBACK_EXPLANATION,
  EXPIRED_KEY_EXPLANATION,
  FIRST_EXECUTION_EXPLANATION,
  RETRY_HIT_EXPLANATION,
} from "./copy";

export interface RuleResult {
  transitionKind: DecisionKind;
  findings: Finding[];
  explanation: string;
  assumptions: string[];
  confidence: Confidence;
}

function finding(ruleId: string, severity: Severity, message: string, suggestion?: string): Finding {
  return suggestion ? { ruleId, severity, message, suggestion } : { ruleId, severity, message };
}

/** contracts/output.schema.json: findings.items.properties.message.maxLength */
const MAX_FINDING_MESSAGE_LENGTH = 1000;
const TRUNCATION_SUFFIX = "… (diferencia recortada)";

/** Recorta un mensaje generado dinámicamente para que nunca supere el
 * maxLength del contrato de salida. Solo puede activarse en la regla de
 * conflicto, que es la única que interpola una lista de longitud arbitraria
 * (hasta 200 claves de nivel superior por payload). */
function clampMessage(message: string): string {
  if (message.length <= MAX_FINDING_MESSAGE_LENGTH) return message;
  return message.slice(0, MAX_FINDING_MESSAGE_LENGTH - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
}

export function ruleFirstExecution(): RuleResult {
  return {
    transitionKind: "first-execution",
    findings: [finding("IDEMP_FIRST_EXECUTION", "info", FIRST_EXECUTION_EXPLANATION)],
    explanation: FIRST_EXECUTION_EXPLANATION,
    assumptions: [
      "No existía registro previo para esta clave: se asume que es la primera vez que se procesa esta operación.",
    ],
    confidence: "high",
  };
}

export function ruleRetryHit(): RuleResult {
  return {
    transitionKind: "retry-hit",
    findings: [finding("IDEMP_RETRY_HIT", "info", RETRY_HIT_EXPLANATION)],
    explanation: RETRY_HIT_EXPLANATION,
    assumptions: [
      "Se asume que huellas canónicas iguales implican la misma operación, aunque el JSON textual difiera (orden de claves, espacios).",
    ],
    confidence: "high",
  };
}

/** Diferencia estructural entre el payload guardado y el nuevo — solo
 * nombres de claves de nivel superior, nunca valores, para no filtrar
 * contenido del payload en los mensajes (ver 08-seguridad-privacidad.md). */
export interface PayloadKeyDiff {
  onlyInStored: string[];
  onlyInIncoming: string[];
  differing: string[];
}

export function diffTopLevelKeys(
  stored: Record<string, unknown>,
  incoming: Record<string, unknown>
): PayloadKeyDiff {
  const storedKeys = new Set(Object.keys(stored));
  const incomingKeys = new Set(Object.keys(incoming));
  const onlyInStored = [...storedKeys].filter((k) => !incomingKeys.has(k)).sort();
  const onlyInIncoming = [...incomingKeys].filter((k) => !storedKeys.has(k)).sort();
  const differing = [...storedKeys]
    .filter((k) => incomingKeys.has(k) && JSON.stringify(stored[k]) !== JSON.stringify(incoming[k]))
    .sort();
  return { onlyInStored, onlyInIncoming, differing };
}

export function ruleKeyConflict(diff: PayloadKeyDiff): RuleResult {
  const parts: string[] = [];
  if (diff.differing.length > 0) parts.push(`claves con valor distinto: ${diff.differing.join(", ")}`);
  if (diff.onlyInIncoming.length > 0) parts.push(`claves nuevas: ${diff.onlyInIncoming.join(", ")}`);
  if (diff.onlyInStored.length > 0) parts.push(`claves ausentes: ${diff.onlyInStored.join(", ")}`);
  const structuralNote = parts.length > 0 ? ` (${parts.join("; ")})` : "";
  const message = clampMessage(`${CONFLICT_EXPLANATION}${structuralNote}`);
  return {
    transitionKind: "conflict",
    findings: [
      finding(
        "IDEMP_KEY_CONFLICT",
        "critical",
        message,
        "usa una nueva clave de idempotencia para una operación distinta"
      ),
    ],
    explanation: message,
    assumptions: [
      "Se asume que la misma clave con distinta huella de payload es un error del cliente (payload cambiado) o una colisión de claves, no una nueva versión válida de la misma operación.",
    ],
    confidence: "high",
  };
}

export function ruleConcurrentGuard(): RuleResult {
  return {
    transitionKind: "concurrent-guard",
    findings: [finding("IDEMP_CONCURRENT_GUARD", "warning", CONCURRENT_GUARD_EXPLANATION)],
    explanation: CONCURRENT_GUARD_EXPLANATION,
    assumptions: [
      "Se asume una única solicitud 'en vuelo' por clave a la vez; una segunda solicitud durante ese margen se trata como colisión de concurrencia, no como una operación independiente.",
    ],
    confidence: "medium",
  };
}

export function ruleExpiredKey(): RuleResult {
  return {
    transitionKind: "expired-key",
    findings: [finding("IDEMP_EXPIRED_KEY", "warning", EXPIRED_KEY_EXPLANATION)],
    explanation: EXPIRED_KEY_EXPLANATION,
    assumptions: [
      "Se asume que superar el TTL configurado localmente basta para tratar la clave como nueva, aunque un sistema real podría seguir rechazando duplicados aguas arriba.",
    ],
    confidence: "medium",
  };
}

export function ruleDependencyFallback(): RuleResult {
  return {
    transitionKind: "dependency-fallback",
    findings: [finding("IDEMP_DEPENDENCY_FALLBACK", "warning", DEPENDENCY_FALLBACK_EXPLANATION)],
    explanation: DEPENDENCY_FALLBACK_EXPLANATION,
    assumptions: [
      "Se asume que, ante un adaptador real no disponible, degradar a la ruta determinista es más seguro que fallar la operación por completo.",
    ],
    confidence: "high",
  };
}
