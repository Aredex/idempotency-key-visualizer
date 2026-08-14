/**
 * Tipos del dominio. Reflejan exactamente contracts/input.schema.json y
 * contracts/output.schema.json (la fuente de verdad), más los tipos internos
 * usados para modelar el motor de idempotencia (registros por clave,
 * transiciones de estado, fixtures de escenario).
 */

export type SchemaVersion = "1.0.0";

/** Envolvente de entrada — ver contracts/input.schema.json */
export interface InputEnvelope {
  schemaVersion: SchemaVersion;
  scenarioId: string;
  payload: Record<string, unknown>;
  options: {
    deterministic: boolean;
  };
}

export type Severity = "info" | "warning" | "error" | "critical";

export interface Finding {
  ruleId: string;
  severity: Severity;
  message: string;
  evidencePath?: string;
  suggestion?: string;
}

export type RunStatus = "completed" | "partial" | "failed" | "cancelled";

/** Envolvente de salida — ver contracts/output.schema.json */
export interface OutputEnvelope {
  schemaVersion: SchemaVersion;
  runId: string;
  status: RunStatus;
  summary: string;
  findings: Finding[];
  evidence: {
    rulesVersion: string;
    scenarioId: string;
  };
}

export type ErrorCode =
  | "INPUT_INVALID"
  | "LIMIT_EXCEEDED"
  | "RUN_CANCELLED"
  | "DEPENDENCY_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface TypedError {
  code: ErrorCode;
  message: string;
  /** Paths JSON (RFC 6901-ish, simplificado) que causaron el error. Nunca contienen valores. */
  paths?: string[];
}

export class EngineError extends Error {
  code: ErrorCode;
  paths?: string[];

  constructor(error: TypedError) {
    super(error.message);
    this.name = "EngineError";
    this.code = error.code;
    this.paths = error.paths;
  }
}

/** Cuánta confianza tiene el motor en la explicación que acompaña una
 * transición. Nunca "certeza" — este simulador solo observa su propio estado
 * local, ver src/domain/copy.ts. */
export type Confidence = "high" | "medium" | "low";

/** Estado de un registro de idempotencia para una clave concreta. */
export type RecordStatus = "absent" | "in-progress" | "completed" | "expired";

/** Qué tipo de decisión tomó el motor al procesar una operación. Cada valor
 * corresponde a una regla en src/domain/rules.ts. */
export type DecisionKind =
  | "first-execution"
  | "retry-hit"
  | "conflict"
  | "concurrent-guard"
  | "expired-key"
  | "input-invalid"
  | "limit-exceeded"
  | "cancelled"
  | "dependency-fallback";

/** Una entrada del historial de transiciones que alimenta la línea de tiempo
 * de la UI. Es un registro append-only (ver EngineState.transitions). */
export interface Transition {
  id: string;
  runId: string;
  kind: DecisionKind;
  atMs: number;
  from: RecordStatus | "none";
  to: RecordStatus;
  explanation: string;
  assumptions: string[];
  confidence: Confidence;
}

/** Estado almacenado para una clave de idempotencia concreta. */
export interface RecordState {
  key: string;
  status: RecordStatus;
  fingerprint?: string;
  storedOutput?: OutputEnvelope;
  storedPayload?: Record<string, unknown>;
  startedAtMs?: number;
  completedAtMs?: number;
  expiresAtMs?: number;
}

/** Estado completo del motor: reloj lógico, registros por clave e historial
 * de transiciones. Inmutable — cada operación produce un EngineState nuevo. */
export interface EngineState {
  clockMs: number;
  records: Record<string, RecordState>;
  transitions: Transition[];
  runCounter: number;
}

/** Un escenario precargado que el visitante puede elegir en la UI. */
export interface ScenarioFixture {
  id: string;
  title: string;
  description: string;
  idempotencyKey: string;
  ttlMs: number;
  initialPayload: Record<string, unknown>;
  tags: Array<"preset" | "boundary" | "adversarial">;
}

/** Reporte exportable (JSON o Markdown) de una ejecución. Ver 06-modelo-datos.md. */
export interface ExportReport {
  runId: string;
  generatedAt: string;
  rulesVersion: string;
  scenarioId: string;
  recordKey: string;
  status: RunStatus;
  summary: string;
  payloadFingerprint: string;
  findings: Finding[];
  transitions: Array<Pick<Transition, "kind" | "explanation" | "assumptions" | "confidence">>;
  assumptions: string[];
  includedPayload?: Record<string, unknown>;
}
