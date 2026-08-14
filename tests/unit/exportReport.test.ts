/**
 * Unitarias de src/domain/exportReport.ts.
 *
 * El control verificable de 08-seguridad-privacidad.md es "la exportación
 * redacta campos configurados": estas pruebas comprueban tanto la redacción
 * (recursiva, insensible a mayúsculas) como el caso por defecto, en el que
 * el payload del visitante ni siquiera llega al reporte.
 */
import { describe, expect, it } from "vitest";
import { applyOperation, createInitialState } from "../../src/domain/engine";
import { buildExportReport, redact, toJson, toMarkdown } from "../../src/domain/exportReport";
import { LIMITS } from "../../src/domain/limits";
import { EngineError } from "../../src/domain/types";
import type { EngineState, ExportReport, InputEnvelope } from "../../src/domain/types";

const KEY = "export-scenario";
const REDACTED = "«redactado»";

/** Valores distintivos que no deben aparecer en un reporte sin payload. */
const SENSITIVE_PAYLOAD = {
  orderId: "ord_VALOR_DISTINTIVO_1",
  customerEmail: "persona@ejemplo.test",
  apiToken: "tok_VALOR_DISTINTIVO_2",
  amountCents: 4599,
  nested: {
    Authorization: "Bearer VALOR_DISTINTIVO_3",
    note: "nota-VALOR_DISTINTIVO_4",
  },
  // La clave se llama `paymentMethods` y no `cards` a propósito: `cards`
  // coincidiría con la denylist y se redactaría entera, y entonces esta
  // prueba dejaría de comprobar el recorrido recursivo por el array.
  paymentMethods: [{ cardNumber: "4111111111111111" }, { label: "etiqueta-VALOR_DISTINTIVO_5" }],
};

const DISTINCTIVE_VALUES = [
  "ord_VALOR_DISTINTIVO_1",
  "persona@ejemplo.test",
  "tok_VALOR_DISTINTIVO_2",
  "Bearer VALOR_DISTINTIVO_3",
  "nota-VALOR_DISTINTIVO_4",
  "4111111111111111",
  "etiqueta-VALOR_DISTINTIVO_5",
];

function envelope(payload: Record<string, unknown>): InputEnvelope {
  return { schemaVersion: "1.0.0", scenarioId: KEY, payload, options: { deterministic: true } };
}

/** Estado con una ejecución completada para KEY. */
function stateWithRun(payload: Record<string, unknown> = SENSITIVE_PAYLOAD): EngineState {
  return applyOperation(createInitialState(), envelope(payload), "aaaaaaaaaaaaaaaa").state;
}

describe("redact", () => {
  it("should replace values of denylisted keys and leave every other key untouched", () => {
    const result = redact({ email: "a@b.c", orderId: "ord_1", amountCents: 10 });

    expect(result).toEqual({ email: REDACTED, orderId: "ord_1", amountCents: 10 });
  });

  it.each(["email", "token", "secret", "password", "authorization", "card", "cvv"])(
    "should redact the key %s",
    (key) => {
      expect(redact({ [key]: "valor-sensible" })[key]).toBe(REDACTED);
    }
  );

  it.each(["EMAIL", "Authorization", "apiToken", "userPassword", "CardNumber", "CVV2", "client_secret"])(
    "should redact %s, matching the denylist case-insensitively and as a substring",
    (key) => {
      expect(redact({ [key]: "valor-sensible" })[key]).toBe(REDACTED);
    }
  );

  it("should recurse through nested objects", () => {
    const result = redact({ user: { profile: { email: "a@b.c", nickname: "ana" } } });

    expect(result).toEqual({ user: { profile: { email: REDACTED, nickname: "ana" } } });
  });

  it("should recurse through arrays of objects", () => {
    const result = redact({ items: [{ token: "t1", sku: "s1" }, { token: "t2", sku: "s2" }] });

    expect(result).toEqual({ items: [{ token: REDACTED, sku: "s1" }, { token: REDACTED, sku: "s2" }] });
  });

  it("should redact the whole value when a denylisted key holds an object", () => {
    expect(redact({ card: { number: "4111", cvv: "123" } }).card).toBe(REDACTED);
  });

  it("should preserve non-string primitives and nulls of allowed keys", () => {
    expect(redact({ count: 0, enabled: false, missing: null })).toEqual({
      count: 0,
      enabled: false,
      missing: null,
    });
  });

  it("should not mutate the input payload", () => {
    const payload = { email: "a@b.c", nested: { token: "t" } };

    redact(payload);

    expect(payload).toEqual({ email: "a@b.c", nested: { token: "t" } });
  });

  it("should honour a custom denylist instead of the default one", () => {
    const result = redact({ email: "a@b.c", iban: "ES00" }, /iban/i);

    expect(result).toEqual({ email: "a@b.c", iban: REDACTED });
  });
});

describe("buildExportReport", () => {
  it("should describe the recorded run: runId, status, scenario and fingerprint", () => {
    const state = stateWithRun();
    const storedOutput = state.records[KEY]?.storedOutput;

    const report = buildExportReport(state, KEY, { includePayload: false });

    expect(report.runId).toBe(storedOutput?.runId);
    expect(report.status).toBe("completed");
    expect(report.recordKey).toBe(KEY);
    expect(report.scenarioId).toBe(KEY);
    expect(report.payloadFingerprint).toBe("aaaaaaaaaaaaaaaa");
  });

  it("should include the findings and the correlated transition explanations", () => {
    const report = buildExportReport(stateWithRun(), KEY, { includePayload: false });

    expect(report.findings.map((f) => f.ruleId)).toEqual(["IDEMP_FIRST_EXECUTION"]);
    expect(report.transitions.map((t) => t.kind)).toEqual(["first-execution"]);
    expect(report.transitions[0]?.explanation.length).toBeGreaterThan(0);
    expect(report.assumptions.length).toBeGreaterThan(0);
  });

  it("should never include any raw payload value when includePayload is false", () => {
    const report = buildExportReport(stateWithRun(), KEY, { includePayload: false });
    const serialized = JSON.stringify(report);

    expect(report.includedPayload).toBeUndefined();
    for (const value of DISTINCTIVE_VALUES) {
      expect(serialized).not.toContain(value);
    }
  });

  it("should include the payload, redacted, when includePayload is true", () => {
    const report = buildExportReport(stateWithRun(), KEY, { includePayload: true });

    expect(report.includedPayload).toBeDefined();
    expect(report.includedPayload).toEqual({
      orderId: "ord_VALOR_DISTINTIVO_1",
      customerEmail: REDACTED,
      apiToken: REDACTED,
      amountCents: 4599,
      nested: { Authorization: REDACTED, note: "nota-VALOR_DISTINTIVO_4" },
      paymentMethods: [{ cardNumber: REDACTED }, { label: "etiqueta-VALOR_DISTINTIVO_5" }],
    });
  });

  it("should keep every denylisted value out of the serialized report even when the payload is included", () => {
    const report = buildExportReport(stateWithRun(), KEY, { includePayload: true });
    const serialized = JSON.stringify(report);

    for (const value of ["persona@ejemplo.test", "tok_VALOR_DISTINTIVO_2", "Bearer VALOR_DISTINTIVO_3", "4111111111111111"]) {
      expect(serialized).not.toContain(value);
    }
  });

  it("should degrade gracefully for a key that has no recorded run", () => {
    const report = buildExportReport(createInitialState(), "clave-inexistente", { includePayload: true });

    expect(report.runId).toBe("");
    expect(report.status).toBe("failed");
    expect(report.findings).toEqual([]);
    expect(report.transitions).toEqual([]);
    expect(report.includedPayload).toBeUndefined();
    expect(report.summary).toContain("clave-inexistente");
  });

  it("should only correlate the transitions of the stored run, not of every run for the key", () => {
    const first = applyOperation(createInitialState(), envelope({ a: 1 }), "aaaaaaaaaaaaaaaa");
    const conflicting = applyOperation(first.state, envelope({ a: 2 }), "bbbbbbbbbbbbbbbb");

    const report = buildExportReport(conflicting.state, KEY, { includePayload: false });

    expect(report.runId).toBe(first.output.runId);
    expect(report.transitions.map((t) => t.kind)).toEqual(["first-execution"]);
  });
});

describe("toJson", () => {
  it("should produce parseable JSON that round-trips the report", () => {
    const report = buildExportReport(stateWithRun(), KEY, { includePayload: true });

    const parsed = JSON.parse(toJson(report)) as ExportReport;

    expect(parsed).toEqual(report);
  });

  it("should throw LIMIT_EXCEEDED when the report exceeds the export budget", () => {
    const oversized = {
      ...buildExportReport(stateWithRun(), KEY, { includePayload: false }),
      summary: "x".repeat(LIMITS.MAX_EXPORT_BYTES + 1),
    };

    expect(() => toJson(oversized)).toThrow(EngineError);
    try {
      toJson(oversized);
    } catch (err) {
      expect((err as EngineError).code).toBe("LIMIT_EXCEEDED");
    }
  });
});

describe("toMarkdown", () => {
  it("should render every documented section", () => {
    const markdown = toMarkdown(buildExportReport(stateWithRun(), KEY, { includePayload: false }));

    expect(markdown).toContain(`# Reporte de idempotencia — ${KEY}`);
    expect(markdown).toContain("## Resumen");
    expect(markdown).toContain("## Hallazgos");
    expect(markdown).toContain("## Transiciones");
    expect(markdown).toContain("## Supuestos");
  });

  it("should render the findings and the transition explanations verbatim", () => {
    const report = buildExportReport(stateWithRun(), KEY, { includePayload: false });

    const markdown = toMarkdown(report);

    expect(markdown).toContain("IDEMP_FIRST_EXECUTION");
    expect(markdown).toContain(report.findings[0]?.message ?? "###");
    expect(markdown).toContain(report.transitions[0]?.explanation ?? "###");
    expect(markdown).toContain(report.assumptions[0] ?? "###");
  });

  it("should render the suggestion of a finding that carries one", () => {
    const first = applyOperation(createInitialState(), envelope({ a: 1 }), "aaaaaaaaaaaaaaaa");
    const conflicting = applyOperation(first.state, envelope({ a: 2 }), "bbbbbbbbbbbbbbbb");
    const report: ExportReport = {
      ...buildExportReport(conflicting.state, KEY, { includePayload: false }),
      findings: conflicting.output.findings,
    };

    expect(toMarkdown(report)).toContain("Sugerencia: usa una nueva clave de idempotencia");
  });

  it("should omit the payload section entirely when the payload was not included", () => {
    const markdown = toMarkdown(buildExportReport(stateWithRun(), KEY, { includePayload: false }));

    expect(markdown).not.toContain("## Payload");
    for (const value of DISTINCTIVE_VALUES) {
      expect(markdown).not.toContain(value);
    }
  });

  it("should render the payload section, redacted, when the payload was included", () => {
    const markdown = toMarkdown(buildExportReport(stateWithRun(), KEY, { includePayload: true }));

    expect(markdown).toContain("## Payload (redactado)");
    expect(markdown).toContain(REDACTED);
    expect(markdown).not.toContain("persona@ejemplo.test");
  });

  it("should deduplicate repeated assumptions", () => {
    const base = buildExportReport(stateWithRun(), KEY, { includePayload: false });
    const report: ExportReport = { ...base, assumptions: ["supuesto repetido", "supuesto repetido"] };

    const occurrences = toMarkdown(report).split("- supuesto repetido").length - 1;

    expect(occurrences).toBe(1);
  });

  it("should render explicit empty-state text instead of blank sections", () => {
    const markdown = toMarkdown(buildExportReport(createInitialState(), "vacia", { includePayload: false }));

    expect(markdown).toContain("_Sin hallazgos._");
    expect(markdown).toContain("_Sin transiciones registradas._");
    expect(markdown).toContain("_Sin supuestos registrados._");
  });

  it("should throw LIMIT_EXCEEDED when the markdown exceeds the export budget", () => {
    const oversized = {
      ...buildExportReport(stateWithRun(), KEY, { includePayload: false }),
      summary: "x".repeat(LIMITS.MAX_EXPORT_BYTES + 1),
    };

    try {
      toMarkdown(oversized);
      throw new Error("Se esperaba un EngineError LIMIT_EXCEEDED.");
    } catch (err) {
      expect(err).toBeInstanceOf(EngineError);
      expect((err as EngineError).code).toBe("LIMIT_EXCEEDED");
    }
  });
});
