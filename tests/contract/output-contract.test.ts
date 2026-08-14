/**
 * Contrato de salida: contracts/output.schema.json.
 *
 * Cada rama del motor produce un OutputEnvelope; el contrato solo sirve de
 * algo si TODAS ellas lo cumplen, incluidas las de error y la cancelación,
 * que son las que más fácilmente se quedan fuera de una revisión manual.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { ValidateFunction } from "ajv/dist/2020";
import { compile, outputSchema } from "./schemas";
import { applyOperation, createInitialState } from "../../src/domain/engine";
import { EngineRuntime } from "../../src/domain/runtime";
import { LIMITS } from "../../src/domain/limits";
import type { EngineState, InputEnvelope, OutputEnvelope, RunStatus } from "../../src/domain/types";

let validate: ValidateFunction;

beforeAll(() => {
  validate = compile(outputSchema);
});

const KEY = "contract-scenario";
const FP_A = "aaaaaaaaaaaaaaaa";
const FP_B = "bbbbbbbbbbbbbbbb";

function envelope(payload: Record<string, unknown> = { a: 1 }): InputEnvelope {
  return { schemaVersion: "1.0.0", scenarioId: KEY, payload, options: { deterministic: true } };
}

function expectValidOutput(output: OutputEnvelope): void {
  const ok = validate(output);
  expect(ok, `Errores del contrato de salida: ${JSON.stringify(validate.errors, null, 2)}`).toBe(true);
  expect(validate.errors ?? []).toEqual([]);
}

function stateWithInFlightKey(): EngineState {
  return { ...createInitialState(), records: { [KEY]: { key: KEY, status: "in-progress" } } };
}

/** Una salida por cada rama terminal del motor, con el status que debe tener. */
function branchOutputs(): Array<{ branch: string; status: RunStatus; output: OutputEnvelope }> {
  const first = applyOperation(createInitialState(), envelope(), FP_A);
  const retry = applyOperation(first.state, envelope(), FP_A);
  const conflict = applyOperation(first.state, envelope({ a: 2 }), FP_B);
  const concurrent = applyOperation(stateWithInFlightKey(), envelope(), FP_A);
  const invalid = applyOperation(
    createInitialState(),
    { ...envelope(), scenarioId: "NO VALIDO" } as InputEnvelope,
    FP_A
  );
  const overLimit = applyOperation(createInitialState(), envelope(tooManyProperties()), FP_A);
  const fallback = applyOperation(
    createInitialState(),
    { ...envelope(), options: { deterministic: false } },
    FP_A
  );
  const expired = applyOperation(
    { ...first.state, clockMs: first.state.records[KEY]?.expiresAtMs ?? 0 },
    envelope(),
    FP_A
  );

  return [
    { branch: "first-execution", status: "completed", output: first.output },
    { branch: "retry-hit", status: "completed", output: retry.output },
    { branch: "conflict", status: "failed", output: conflict.output },
    { branch: "concurrent-guard", status: "partial", output: concurrent.output },
    { branch: "input-invalid", status: "failed", output: invalid.output },
    { branch: "limit-exceeded", status: "failed", output: overLimit.output },
    { branch: "dependency-fallback", status: "completed", output: fallback.output },
    { branch: "expired-key + first-execution", status: "completed", output: expired.output },
  ];
}

function tooManyProperties(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (let i = 0; i <= LIMITS.MAX_PAYLOAD_PROPERTIES; i += 1) payload[`prop_${i}`] = i;
  return payload;
}

describe("contracts/output.schema.json", () => {
  it("should compile as a JSON Schema 2020-12 document in strict mode", () => {
    expect(typeof validate).toBe("function");
  });

  it.each(branchOutputs().map((b) => [b.branch, b] as const))(
    "should produce a schema-valid envelope for the %s branch",
    (_branch, { status, output }) => {
      expect(output.status).toBe(status);
      expectValidOutput(output);
    }
  );

  it("should cover all four declared run statuses across the branches plus cancellation", async () => {
    const runtime = new EngineRuntime();
    const handle = runtime.submit(envelope());
    runtime.cancel(handle.requestId);
    const cancelled = await handle.promise;

    const statuses = new Set([...branchOutputs().map((b) => b.status), cancelled.status]);

    expect([...statuses].sort()).toEqual(["cancelled", "completed", "failed", "partial"]);
  });
});

describe("cancelación", () => {
  it("should produce a schema-valid cancelled envelope", async () => {
    const runtime = new EngineRuntime();
    const handle = runtime.submit(envelope());

    runtime.cancel(handle.requestId);
    const output = await handle.promise;

    expect(output.status).toBe("cancelled");
    expectValidOutput(output);
  });

  it("should resolve rather than reject, so cancellation is a result and not a thrown error", async () => {
    const runtime = new EngineRuntime();
    const handle = runtime.submit(envelope());

    runtime.cancel(handle.requestId);

    await expect(handle.promise).resolves.toMatchObject({ status: "cancelled" });
  });
});

describe("límites de longitud del contrato de salida", () => {
  it("should keep the summary within maxLength even for the longest allowed scenarioId", () => {
    const longScenarioId = "a".repeat(LIMITS.MAX_SCENARIO_ID_LENGTH);
    const input: InputEnvelope = { ...envelope(), scenarioId: longScenarioId };

    const result = applyOperation(createInitialState(), input, FP_A);

    expect(result.output.summary.length).toBeLessThanOrEqual(500);
    expectValidOutput(result.output);
  });

  it("should keep the conflict finding within maxLength when every top-level key differs", () => {
    // Regresión: la nota estructural del conflicto interpola hasta 200
    // nombres de clave por lado, lo que desbordaba message.maxLength (1000).
    const stored: Record<string, unknown> = {};
    const incoming: Record<string, unknown> = {};
    for (let i = 0; i < LIMITS.MAX_PAYLOAD_PROPERTIES; i += 1) {
      stored[`propiedad_original_${i}`] = i;
      incoming[`propiedad_modificada_${i}`] = i;
    }
    const first = applyOperation(createInitialState(), envelope(stored), FP_A);

    const conflict = applyOperation(first.state, envelope(incoming), FP_B);

    expect(conflict.output.status).toBe("failed");
    expect(conflict.output.findings[0]?.message.length).toBeLessThanOrEqual(1000);
    expectValidOutput(conflict.output);
  });

  it("should never emit more findings than the contract allows", () => {
    for (const { output } of branchOutputs()) {
      expect(output.findings.length).toBeLessThanOrEqual(LIMITS.MAX_FINDINGS_PER_RUN);
    }
  });
});
