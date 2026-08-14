/**
 * Motor PURO y SÍNCRONO de idempotencia: sin temporizadores, sin I/O, sin
 * lectura de reloj real. Toda mutación de estado se modela como "state in,
 * state out" (nunca se muta `state` en el sitio), lo que lo hace trivial de
 * testear con inputs deterministas.
 *
 * El fingerprint del payload es async (SHA-256 vía crypto.subtle), así que
 * `applyOperation` lo recibe ya calculado: es responsabilidad de la capa con
 * estado (EngineRuntime, ver runtime.ts) calcularlo antes de llamar aquí.
 *
 * Contrato total: `applyOperation` nunca lanza. Cualquier EngineError
 * producido por la validación se captura internamente y se convierte en un
 * OutputEnvelope con status "failed" más una Transition explicando el
 * rechazo, para que el resto del motor pueda tratar cada llamada como
 * "siempre responde algo".
 */
import { LIMITS } from "./limits";
import { validateInputEnvelope } from "./envelope";
import { generateRunId } from "./hash";
import { isExpired } from "./clock";
import { getScenario } from "./fixtures/scenarios";
import {
  diffTopLevelKeys,
  ruleConcurrentGuard,
  ruleDependencyFallback,
  ruleExpiredKey,
  ruleFirstExecution,
  ruleKeyConflict,
  ruleRetryHit,
  type RuleResult,
} from "./rules";
import type {
  DecisionKind,
  EngineState,
  Finding,
  InputEnvelope,
  OutputEnvelope,
  RecordState,
  RecordStatus,
  Transition,
} from "./types";
import { EngineError } from "./types";

const RULES_VERSION = "1.0.0";

export function createInitialState(): EngineState {
  return { clockMs: 0, records: {}, transitions: [], runCounter: 0 };
}

/** Añade transiciones nuevas al historial, recortando las más antiguas si se
 * supera LIMITS.MAX_TRANSITIONS_HISTORY (la línea de tiempo es un log, no
 * necesita crecer sin límite en una demo larga). Exportada para que
 * runtime.ts pueda reusarla al anexar la transición sintética "cancelled". */
export function appendTransitions(existing: Transition[], added: Transition[]): Transition[] {
  const merged = [...existing, ...added];
  if (merged.length <= LIMITS.MAX_TRANSITIONS_HISTORY) return merged;
  return merged.slice(merged.length - LIMITS.MAX_TRANSITIONS_HISTORY);
}

function makeTransition(args: {
  runId: string;
  kind: DecisionKind;
  atMs: number;
  from: RecordStatus | "none";
  to: RecordStatus;
  rule: Pick<RuleResult, "explanation" | "assumptions" | "confidence">;
}): Transition {
  return {
    id: crypto.randomUUID(),
    runId: args.runId,
    kind: args.kind,
    atMs: args.atMs,
    from: args.from,
    to: args.to,
    explanation: args.rule.explanation,
    assumptions: args.rule.assumptions,
    confidence: args.rule.confidence,
  };
}

/** Exportada para que runtime.ts pueda resolver la clave de forma síncrona
 * ANTES de esperar el fingerprint, así la comprobación de lock puede
 * ocurrir en el mismo tick en que llega la solicitud. */
export function resolveKeyAndTtl(input: InputEnvelope): { key: string; ttlMs: number } {
  const fixture = getScenario(input.scenarioId);
  if (fixture) return { key: fixture.idempotencyKey, ttlMs: fixture.ttlMs };
  // Escenario ad hoc (no está en fixtures/scenarios.ts): se usa el propio
  // scenarioId como clave, lo que permite a tests y usuarios avanzados
  // ejercitar el motor sin pasar por la lista de escenarios precargados.
  return { key: input.scenarioId, ttlMs: LIMITS.DEFAULT_TTL_MS };
}

function buildErrorResult(
  state: EngineState,
  rawInput: unknown,
  err: unknown
): { state: EngineState; output: OutputEnvelope; transition: Transition } {
  const engineError =
    err instanceof EngineError
      ? err
      : new EngineError({ code: "INTERNAL_ERROR", message: "Fallo interno no clasificado en el motor." });

  const scenarioIdGuess =
    typeof rawInput === "object" && rawInput !== null && typeof (rawInput as Record<string, unknown>).scenarioId === "string"
      ? ((rawInput as Record<string, unknown>).scenarioId as string)
      : "invalid-input";

  const runId = generateRunId(scenarioIdGuess);
  const finding: Finding = {
    ruleId: engineError.code,
    severity: "error",
    message: engineError.message,
    ...(engineError.paths && engineError.paths.length > 0 ? { evidencePath: engineError.paths.join(", ") } : {}),
  };

  const output: OutputEnvelope = {
    schemaVersion: "1.0.0",
    runId,
    status: "failed",
    summary: engineError.message.slice(0, 500),
    findings: [finding],
    evidence: { rulesVersion: RULES_VERSION, scenarioId: scenarioIdGuess },
  };

  const kind: DecisionKind = engineError.code === "LIMIT_EXCEEDED" ? "limit-exceeded" : "input-invalid";
  const transition = makeTransition({
    runId,
    kind,
    atMs: state.clockMs,
    from: "none",
    to: "absent",
    rule: { explanation: engineError.message, assumptions: [], confidence: "high" },
  });

  return {
    state: {
      ...state,
      transitions: appendTransitions(state.transitions, [transition]),
      runCounter: state.runCounter + 1,
    },
    output,
    transition,
  };
}

export function applyOperation(
  state: EngineState,
  input: InputEnvelope,
  fingerprintHex: string
): { state: EngineState; output: OutputEnvelope; transition: Transition } {
  let validated: InputEnvelope;
  try {
    // Se revalida en tiempo de ejecución aunque el tipo estático diga que ya
    // es un InputEnvelope: el dato puede venir de postMessage/JSON.parse y el
    // tipo por sí solo no garantiza nada en runtime.
    validated = validateInputEnvelope(input);
  } catch (err) {
    return buildErrorResult(state, input, err);
  }

  const { key, ttlMs } = resolveKeyAndTtl(validated);
  const originalRecord: RecordState = state.records[key] ?? { key, status: "absent" };
  // "none" refleja que la clave nunca existió en absoluto (nunca hubo ni
  // siquiera un registro sintético "absent"); distinto de "expired", que sí
  // hubo un registro y venció. Solo importa para el campo `from` de la
  // transición terminal, no cambia ninguna decisión del motor.
  const priorStatus: RecordStatus | "none" = key in state.records ? originalRecord.status : "none";
  const workingClockMs = state.clockMs; // reloj de trabajo: un único tick al final de la llamada

  const newTransitions: Transition[] = [];
  let finalRunId = "";
  let effectiveRecord = originalRecord;

  // --- Paso 9: fallback de adaptador (options.deterministic === false) ---
  // El fallback nunca cambia qué rama se toma después: solo añade una nota
  // explicando que se degradó a la ruta determinista.
  let fallbackResult: RuleResult | undefined;
  if (!validated.options.deterministic) {
    fallbackResult = ruleDependencyFallback();
  }

  // --- Paso 4: expiración perezosa (completed + TTL superado) ---
  let expiredResult: RuleResult | undefined;
  if (effectiveRecord.status === "completed" && isExpired(effectiveRecord, workingClockMs)) {
    expiredResult = ruleExpiredKey();
    effectiveRecord = { key, status: "absent" };
  }

  let output: OutputEnvelope;
  let terminalKind: DecisionKind;
  let terminalFrom: RecordStatus | "none";
  let terminalTo: RecordStatus;
  let terminalRule: RuleResult;
  let nextRecordForKey: RecordState = effectiveRecord;
  let advancesClock = false;

  if (effectiveRecord.status === "in-progress") {
    // --- Paso 5: guarda de concurrencia ---
    // El motor síncrono nunca deja un registro "in-progress" por sí mismo
    // entre llamadas; es EngineRuntime quien pre-popula este estado en el
    // EngineState que entrega aquí cuando una segunda solicitud para la
    // misma clave llega antes de que el timer de la primera dispare.
    terminalRule = ruleConcurrentGuard();
    finalRunId = generateRunId(validated.scenarioId);
    terminalKind = "concurrent-guard";
    terminalFrom = "in-progress";
    terminalTo = "in-progress";
    output = {
      schemaVersion: "1.0.0",
      runId: finalRunId,
      status: "partial",
      summary: `Solicitud concurrente para la clave "${key}": la primera solicitud sigue en curso.`,
      findings: [...(fallbackResult?.findings ?? []), ...terminalRule.findings],
      evidence: { rulesVersion: RULES_VERSION, scenarioId: validated.scenarioId },
    };
    nextRecordForKey = originalRecord; // no se toca el registro almacenado
  } else if (effectiveRecord.status === "absent" || effectiveRecord.status === "expired") {
    // --- Paso 6: primera ejecución (nueva clave, o clave recién expirada) ---
    terminalRule = ruleFirstExecution();
    finalRunId = generateRunId(validated.scenarioId);
    terminalKind = "first-execution";
    terminalFrom = expiredResult ? "expired" : priorStatus;
    terminalTo = "completed";
    output = {
      schemaVersion: "1.0.0",
      runId: finalRunId,
      status: "completed",
      summary: `Primera ejecución para la clave "${key}": resultado guardado para futuros reintentos.`,
      findings: [...(fallbackResult?.findings ?? []), ...terminalRule.findings],
      evidence: { rulesVersion: RULES_VERSION, scenarioId: validated.scenarioId },
    };
    nextRecordForKey = {
      key,
      status: "completed",
      fingerprint: fingerprintHex,
      storedOutput: output,
      storedPayload: validated.payload,
      completedAtMs: workingClockMs,
      expiresAtMs: workingClockMs + ttlMs,
    };
    advancesClock = true;
  } else if (fingerprintHex === effectiveRecord.fingerprint && effectiveRecord.storedOutput) {
    // --- Paso 7: retry-hit (misma clave, misma huella) ---
    terminalRule = ruleRetryHit();
    output = effectiveRecord.storedOutput; // sin cambios: el runId es el original
    finalRunId = output.runId;
    terminalKind = "retry-hit";
    terminalFrom = "completed";
    terminalTo = "completed";
    nextRecordForKey = originalRecord; // no se muta el registro guardado
    advancesClock = true;
  } else {
    // --- Paso 8: conflicto (misma clave, huella distinta) ---
    const diff = diffTopLevelKeys(effectiveRecord.storedPayload ?? {}, validated.payload);
    terminalRule = ruleKeyConflict(diff);
    finalRunId = generateRunId(validated.scenarioId);
    terminalKind = "conflict";
    terminalFrom = "completed";
    terminalTo = "completed";
    output = {
      schemaVersion: "1.0.0",
      runId: finalRunId,
      status: "failed",
      summary: `Conflicto de idempotencia en la clave "${key}": el payload no coincide con el guardado originalmente.`,
      findings: [...(fallbackResult?.findings ?? []), ...terminalRule.findings],
      evidence: { rulesVersion: RULES_VERSION, scenarioId: validated.scenarioId },
    };
    nextRecordForKey = originalRecord; // no se sobrescribe el registro guardado
    advancesClock = true;
  }

  if (fallbackResult) {
    newTransitions.push(
      makeTransition({
        runId: finalRunId,
        kind: "dependency-fallback",
        atMs: workingClockMs,
        from: priorStatus,
        to: priorStatus === "none" ? "absent" : priorStatus,
        rule: fallbackResult,
      })
    );
  }
  if (expiredResult) {
    newTransitions.push(
      makeTransition({
        runId: finalRunId,
        kind: "expired-key",
        atMs: workingClockMs,
        from: "completed",
        to: "expired",
        rule: expiredResult,
      })
    );
  }
  const terminalTransition = makeTransition({
    runId: finalRunId,
    kind: terminalKind,
    atMs: workingClockMs,
    from: terminalFrom,
    to: terminalTo,
    rule: terminalRule,
  });
  newTransitions.push(terminalTransition);

  const nextClockMs = advancesClock ? workingClockMs + LIMITS.CLOCK_TICK_MS : workingClockMs;
  const nextState: EngineState = {
    clockMs: nextClockMs,
    records: { ...state.records, [key]: nextRecordForKey },
    transitions: appendTransitions(state.transitions, newTransitions),
    runCounter: state.runCounter + 1,
  };

  return { state: nextState, output, transition: terminalTransition };
}

/**
 * Recorre todos los registros y expira (perezosa pero proactivamente) los
 * que ya superaron su TTL, registrando la transición correspondiente.
 * Decisión: `advanceClock` SÍ llama a esta función automáticamente, para que
 * mover el reloj desde la UI (sin necesidad de volver a enviar la operación)
 * ya deje visible en la línea de tiempo que una clave expiró — se acerca más
 * a cómo se percibiría un TTL real. La alternativa (expirar solo de forma
 * perezosa dentro de applyOperation) también es válida y se sigue soportando
 * tal cual la usa applyOperation internamente.
 */
export function checkExpiredKeys(state: EngineState): EngineState {
  const newTransitions: Transition[] = [];
  const nextRecords: Record<string, RecordState> = { ...state.records };
  let changed = false;

  for (const [key, record] of Object.entries(state.records)) {
    if (record.status === "completed" && isExpired(record, state.clockMs)) {
      const rule = ruleExpiredKey();
      const runId = generateRunId(key);
      newTransitions.push(
        makeTransition({
          runId,
          kind: "expired-key",
          atMs: state.clockMs,
          from: "completed",
          to: "expired",
          rule,
        })
      );
      nextRecords[key] = { ...record, status: "expired" };
      changed = true;
    }
  }

  if (!changed) return state;

  return {
    ...state,
    records: nextRecords,
    transitions: appendTransitions(state.transitions, newTransitions),
  };
}

export function advanceClock(state: EngineState, ms: number): EngineState {
  const advanced: EngineState = { ...state, clockMs: state.clockMs + ms };
  return checkExpiredKeys(advanced);
}

/** Reinicia solo una clave (vuelve a "absent"). No limpia el historial de
 * transiciones: la línea de tiempo es un log, no estado de escenario. */
export function resetScenario(state: EngineState, key: string): EngineState {
  if (!(key in state.records)) return state;
  const nextRecords = { ...state.records };
  delete nextRecords[key];
  return { ...state, records: nextRecords };
}

/** Borrado completo: vuelve al estado inicial, incluido el historial. Usado
 * por el botón "Eliminar datos locales". */
export function resetAll(_state: EngineState): EngineState {
  return createInitialState();
}
