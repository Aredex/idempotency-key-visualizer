/**
 * Unitarias del motor puro (src/domain/engine.ts).
 *
 * `applyOperation` es síncrono y "state in / state out", así que aquí no
 * hace falta ni worker ni temporizadores: se construye el EngineState a mano
 * (incluido el estado "in-progress", que en producción solo produce
 * EngineRuntime) y se comprueba la decisión resultante.
 */
import { describe, expect, it } from "vitest";
import {
  advanceClock,
  applyOperation,
  createInitialState,
  resetAll,
  resetScenario,
} from "../../src/domain/engine";
import { LIMITS } from "../../src/domain/limits";
import type { EngineState, InputEnvelope, RecordState, Transition } from "../../src/domain/types";

const KEY = "ad-hoc-key";
const OTHER_KEY = "otra-clave";
const FP_A = "aaaaaaaaaaaaaaaa";
const FP_B = "bbbbbbbbbbbbbbbb";

function input(overrides: Partial<InputEnvelope> = {}): InputEnvelope {
  return {
    schemaVersion: "1.0.0",
    scenarioId: KEY,
    payload: { orderId: "ord_1", amountCents: 4599 },
    options: { deterministic: true },
    ...overrides,
  };
}

function kindsOf(transitions: Transition[]): string[] {
  return transitions.map((t) => t.kind);
}

function recordOf(state: EngineState, key: string): RecordState {
  const record = state.records[key];
  if (!record) throw new Error(`No hay registro para la clave "${key}" en el estado.`);
  return record;
}

describe("applyOperation — primera ejecución", () => {
  it("should complete a submit for a brand-new key and store the result", () => {
    const result = applyOperation(createInitialState(), input(), FP_A);

    expect(result.output.status).toBe("completed");
    expect(result.transition.kind).toBe("first-execution");
    expect(recordOf(result.state, KEY).status).toBe("completed");
    expect(recordOf(result.state, KEY).storedOutput?.runId).toBe(result.output.runId);
    expect(recordOf(result.state, KEY).fingerprint).toBe(FP_A);
  });

  it("should report `from: \"none\"` when the key never existed at all", () => {
    const result = applyOperation(createInitialState(), input(), FP_A);

    expect(result.transition.from).toBe("none");
    expect(result.transition.to).toBe("completed");
  });

  it("should emit exactly one finding, of severity info, on the happy path", () => {
    const result = applyOperation(createInitialState(), input(), FP_A);

    expect(result.output.findings).toHaveLength(1);
    expect(result.output.findings[0]?.ruleId).toBe("IDEMP_FIRST_EXECUTION");
    expect(result.output.findings[0]?.severity).toBe("info");
  });
});

describe("applyOperation — retry-hit (P5-R2: persistir el primer resultado)", () => {
  it("should return the exact same runId as the first execution when the payload is unchanged", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const second = applyOperation(first.state, input(), FP_A);

    expect(second.transition.kind).toBe("retry-hit");
    expect(second.output.status).toBe("completed");
    expect(second.output.runId).toBe(first.output.runId);
  });

  it("should return the stored output object itself, not a freshly recomputed one", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const second = applyOperation(first.state, input(), FP_A);

    expect(second.output).toEqual(first.output);
    expect(recordOf(second.state, KEY).storedOutput?.runId).toBe(first.output.runId);
  });

  it("should keep returning the original runId across many retries", () => {
    let state = createInitialState();
    const first = applyOperation(state, input(), FP_A);
    state = first.state;

    for (let i = 0; i < 5; i += 1) {
      const retry = applyOperation(state, input(), FP_A);
      state = retry.state;
      expect(retry.output.runId).toBe(first.output.runId);
    }
  });
});

describe("applyOperation — conflicto (P5-R3)", () => {
  it("should fail with a conflict when the same key arrives with a different fingerprint", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const conflicting = applyOperation(
      first.state,
      input({ payload: { orderId: "ord_1", amountCents: 9999 } }),
      FP_B
    );

    expect(conflicting.transition.kind).toBe("conflict");
    expect(conflicting.output.status).toBe("failed");
    expect(conflicting.output.findings.some((f) => f.ruleId === "IDEMP_KEY_CONFLICT")).toBe(true);
  });

  it("should never overwrite the stored record with the conflicting call", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const conflicting = applyOperation(
      first.state,
      input({ payload: { orderId: "ord_1", amountCents: 9999 } }),
      FP_B
    );
    const stored = recordOf(conflicting.state, KEY);

    expect(stored.storedOutput?.runId).toBe(first.output.runId);
    expect(stored.fingerprint).toBe(FP_A);
    expect(stored.storedPayload).toEqual({ orderId: "ord_1", amountCents: 4599 });
    expect(conflicting.output.runId).not.toBe(first.output.runId);
  });

  it("should still serve the original result to a later correct retry after a conflict", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);
    const conflicting = applyOperation(first.state, input({ payload: { other: true } }), FP_B);

    const retry = applyOperation(conflicting.state, input(), FP_A);

    expect(retry.transition.kind).toBe("retry-hit");
    expect(retry.output.runId).toBe(first.output.runId);
  });

  it("should describe the differing top-level keys without leaking their values", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const conflicting = applyOperation(
      first.state,
      input({ payload: { orderId: "ord_1", amountCents: 9999, coupon: "SECRET-CODE" } }),
      FP_B
    );
    const finding = conflicting.output.findings.find((f) => f.ruleId === "IDEMP_KEY_CONFLICT");

    expect(finding?.message).toContain("amountCents");
    expect(finding?.message).toContain("coupon");
    expect(finding?.message).not.toContain("SECRET-CODE");
    expect(finding?.message).not.toContain("9999");
  });
});

describe("applyOperation — guarda de concurrencia (P5-R4)", () => {
  function stateWithInFlightKey(): EngineState {
    return {
      ...createInitialState(),
      records: { [KEY]: { key: KEY, status: "in-progress", startedAtMs: 0 } },
    };
  }

  it("should return a partial result when the key is already in-progress", () => {
    const result = applyOperation(stateWithInFlightKey(), input(), FP_A);

    expect(result.transition.kind).toBe("concurrent-guard");
    expect(result.output.status).toBe("partial");
    expect(result.output.findings.some((f) => f.ruleId === "IDEMP_CONCURRENT_GUARD")).toBe(true);
  });

  it("should leave the in-progress record untouched", () => {
    const before = stateWithInFlightKey();

    const result = applyOperation(before, input(), FP_A);

    expect(recordOf(result.state, KEY)).toEqual(recordOf(before, KEY));
    expect(recordOf(result.state, KEY).storedOutput).toBeUndefined();
  });

  it("should not advance the logical clock, because nothing was actually processed", () => {
    const before = stateWithInFlightKey();

    const result = applyOperation(before, input(), FP_A);

    expect(result.state.clockMs).toBe(before.clockMs);
  });
});

describe("applyOperation — expiración de clave", () => {
  function stateWithExpiredRecord(): EngineState {
    const first = applyOperation(createInitialState(), input(), FP_A);
    const expiresAtMs = recordOf(first.state, KEY).expiresAtMs ?? 0;
    return { ...first.state, clockMs: expiresAtMs };
  }

  it("should emit an expired-key transition followed by a fresh first-execution", () => {
    const before = stateWithExpiredRecord();

    const result = applyOperation(before, input(), FP_A);
    const newKinds = kindsOf(result.state.transitions.slice(before.transitions.length));

    expect(newKinds).toEqual(["expired-key", "first-execution"]);
    expect(result.transition.kind).toBe("first-execution");
    expect(result.transition.from).toBe("expired");
    expect(result.output.status).toBe("completed");
  });

  it("should mint a new runId after expiry instead of replaying the pre-expiry one", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);
    const expiresAtMs = recordOf(first.state, KEY).expiresAtMs ?? 0;

    const afterExpiry = applyOperation({ ...first.state, clockMs: expiresAtMs }, input(), FP_A);

    expect(afterExpiry.output.runId).not.toBe(first.output.runId);
    expect(recordOf(afterExpiry.state, KEY).storedOutput?.runId).toBe(afterExpiry.output.runId);
  });

  it("should still serve a retry-hit one millisecond before the TTL is reached", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);
    const expiresAtMs = recordOf(first.state, KEY).expiresAtMs ?? 0;

    const justBefore = applyOperation({ ...first.state, clockMs: expiresAtMs - 1 }, input(), FP_A);

    expect(justBefore.transition.kind).toBe("retry-hit");
    expect(justBefore.output.runId).toBe(first.output.runId);
  });
});

describe("applyOperation — fallback de dependencia (options.deterministic:false)", () => {
  it("should append a dependency-fallback transition before the terminal one", () => {
    const before = createInitialState();

    const result = applyOperation(before, input({ options: { deterministic: false } }), FP_A);
    const newKinds = kindsOf(result.state.transitions.slice(before.transitions.length));

    expect(newKinds).toEqual(["dependency-fallback", "first-execution"]);
  });

  it("should still complete the operation normally through the deterministic path", () => {
    const result = applyOperation(createInitialState(), input({ options: { deterministic: false } }), FP_A);

    expect(result.output.status).toBe("completed");
    expect(result.transition.kind).toBe("first-execution");
    expect(result.output.findings.map((f) => f.ruleId)).toEqual([
      "IDEMP_DEPENDENCY_FALLBACK",
      "IDEMP_FIRST_EXECUTION",
    ]);
  });

  it("should not change which branch is taken: a conflict stays a conflict", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const conflicting = applyOperation(
      first.state,
      input({ payload: { other: true }, options: { deterministic: false } }),
      FP_B
    );

    expect(conflicting.transition.kind).toBe("conflict");
    expect(conflicting.output.status).toBe("failed");
    expect(conflicting.output.findings.map((f) => f.ruleId)).toEqual([
      "IDEMP_DEPENDENCY_FALLBACK",
      "IDEMP_KEY_CONFLICT",
    ]);
  });

  it("should not change which branch is taken: a retry stays a retry with the original runId", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const retry = applyOperation(first.state, input({ options: { deterministic: false } }), FP_A);

    expect(retry.transition.kind).toBe("retry-hit");
    expect(retry.output.runId).toBe(first.output.runId);
  });
});

describe("applyOperation — entrada inválida", () => {
  it("should never throw: an invalid envelope becomes a failed run with a typed finding", () => {
    const invalid = { schemaVersion: "1.0.0", scenarioId: "NOPE", payload: {}, options: {} };

    const result = applyOperation(createInitialState(), invalid as unknown as InputEnvelope, FP_A);

    expect(result.output.status).toBe("failed");
    expect(result.transition.kind).toBe("input-invalid");
    expect(result.output.findings[0]?.ruleId).toBe("INPUT_INVALID");
    expect(result.output.findings[0]?.severity).toBe("error");
  });

  it("should classify a limit violation as limit-exceeded, not as generic invalid input", () => {
    const payload: Record<string, unknown> = {};
    for (let i = 0; i <= LIMITS.MAX_PAYLOAD_PROPERTIES; i += 1) payload[`prop_${i}`] = i;

    const result = applyOperation(createInitialState(), input({ payload }), FP_A);

    expect(result.transition.kind).toBe("limit-exceeded");
    expect(result.output.findings[0]?.ruleId).toBe("LIMIT_EXCEEDED");
  });

  it("should not create or modify any record for an invalid input", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const invalid = applyOperation(first.state, input({ scenarioId: "NOPE" }), FP_B);

    expect(recordOf(invalid.state, KEY).storedOutput?.runId).toBe(first.output.runId);
    expect(Object.keys(invalid.state.records)).toEqual([KEY]);
  });
});

describe("appendTransitions — tope del historial", () => {
  it("should never exceed MAX_TRANSITIONS_HISTORY, dropping the oldest entries first", () => {
    let state = applyOperation(createInitialState(), input(), FP_A).state;
    const oldestId = state.transitions[0]?.id;

    // Con deterministic:false cada llamada añade dos transiciones, así que
    // este bucle desborda el tope con holgura.
    for (let i = 0; i < LIMITS.MAX_TRANSITIONS_HISTORY; i += 1) {
      state = applyOperation(state, input({ options: { deterministic: false } }), FP_A).state;
    }

    expect(state.transitions).toHaveLength(LIMITS.MAX_TRANSITIONS_HISTORY);
    expect(state.transitions.some((t) => t.id === oldestId)).toBe(false);
  });

  it("should keep the most recent transition at the end of the history", () => {
    let state = createInitialState();
    for (let i = 0; i < LIMITS.MAX_TRANSITIONS_HISTORY + 10; i += 1) {
      state = applyOperation(state, input({ options: { deterministic: false } }), FP_A).state;
    }
    const last = applyOperation(state, input(), FP_A);

    expect(last.state.transitions[last.state.transitions.length - 1]?.id).toBe(last.transition.id);
  });
});

describe("advanceClock", () => {
  it("should move the logical clock forward by exactly the requested amount", () => {
    const state = advanceClock(createInitialState(), 1234);

    expect(state.clockMs).toBe(1234);
  });

  it("should proactively expire a completed record whose TTL was crossed", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);
    const expiresAtMs = recordOf(first.state, KEY).expiresAtMs ?? 0;

    const advanced = advanceClock(first.state, expiresAtMs - first.state.clockMs);

    expect(recordOf(advanced, KEY).status).toBe("expired");
    expect(kindsOf(advanced.transitions.slice(first.state.transitions.length))).toEqual(["expired-key"]);
  });

  it("should leave records and transitions untouched when nothing has expired", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const advanced = advanceClock(first.state, 1);

    expect(recordOf(advanced, KEY).status).toBe("completed");
    expect(advanced.transitions).toHaveLength(first.state.transitions.length);
  });
});

describe("resetScenario / resetAll", () => {
  it("should clear only the requested key, leaving other keys intact", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);
    const second = applyOperation(first.state, input({ scenarioId: OTHER_KEY }), FP_B);

    const reset = resetScenario(second.state, KEY);

    expect(reset.records[KEY]).toBeUndefined();
    expect(recordOf(reset, OTHER_KEY).storedOutput?.runId).toBe(second.output.runId);
  });

  it("should keep the transition history, because the timeline is a log and not scenario state", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const reset = resetScenario(first.state, KEY);

    expect(reset.transitions).toEqual(first.state.transitions);
  });

  it("should be a no-op for an unknown key", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    expect(resetScenario(first.state, "clave-que-no-existe")).toBe(first.state);
  });

  it("should let a reset key execute again as a first execution with a new runId", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);

    const afterReset = applyOperation(resetScenario(first.state, KEY), input(), FP_A);

    expect(afterReset.transition.kind).toBe("first-execution");
    expect(afterReset.output.runId).not.toBe(first.output.runId);
  });

  it("should return the pristine initial state from resetAll", () => {
    const first = applyOperation(createInitialState(), input(), FP_A);
    const second = applyOperation(first.state, input({ scenarioId: OTHER_KEY }), FP_B);

    expect(resetAll(second.state)).toEqual(createInitialState());
  });
});
