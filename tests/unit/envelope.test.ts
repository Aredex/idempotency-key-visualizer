/**
 * Unitarias del validador escrito a mano (src/domain/envelope.ts).
 *
 * Este validador es la única barrera de entrada del motor en el navegador
 * (no se usa ajv en el bundle por CSP), así que cada rama de rechazo se
 * prueba por su `code` tipado y por los `paths` que reporta — nunca por el
 * texto del mensaje, que puede reescribirse sin romper el contrato.
 */
import { describe, expect, it } from "vitest";
import { parsePayloadText, validateInputEnvelope } from "../../src/domain/envelope";
import { LIMITS } from "../../src/domain/limits";
import { EngineError } from "../../src/domain/types";
import type { InputEnvelope } from "../../src/domain/types";

function validEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    scenarioId: "charge-card",
    payload: { orderId: "ord_7f3e", amountCents: 4599 },
    options: { deterministic: true },
    ...overrides,
  };
}

/** Captura el EngineError lanzado, fallando el test si no se lanza ninguno. */
function captureError(fn: () => unknown): EngineError {
  try {
    fn();
  } catch (err) {
    if (err instanceof EngineError) return err;
    throw err;
  }
  throw new Error("Se esperaba que la llamada lanzara un EngineError, pero no lanzó nada.");
}

/** Objeto anidado `depth` niveles por debajo de la raíz del payload. */
function nestedPayload(depth: number): Record<string, unknown> {
  let value: unknown = 1;
  for (let i = 0; i < depth; i += 1) value = { level: value };
  return value as Record<string, unknown>;
}

describe("validateInputEnvelope — entradas válidas", () => {
  it("should accept a well-formed envelope and return it typed", () => {
    const input = validEnvelope();

    const result: InputEnvelope = validateInputEnvelope(input);

    expect(result.scenarioId).toBe("charge-card");
    expect(result.options.deterministic).toBe(true);
  });

  it("should accept an empty payload object", () => {
    expect(() => validateInputEnvelope(validEnvelope({ payload: {} }))).not.toThrow();
  });

  it("should accept a payload exactly at the top-level property limit", () => {
    const payload: Record<string, unknown> = {};
    for (let i = 0; i < LIMITS.MAX_PAYLOAD_PROPERTIES; i += 1) payload[`prop_${i}`] = i;

    expect(() => validateInputEnvelope(validEnvelope({ payload }))).not.toThrow();
  });

  it("should accept a scenarioId exactly at the maximum length", () => {
    const scenarioId = "a".repeat(LIMITS.MAX_SCENARIO_ID_LENGTH);

    expect(() => validateInputEnvelope(validEnvelope({ scenarioId }))).not.toThrow();
  });

  it("should accept deterministic:false, which is a supported mode and not an error", () => {
    expect(() => validateInputEnvelope(validEnvelope({ options: { deterministic: false } }))).not.toThrow();
  });
});

describe("validateInputEnvelope — forma de la envolvente", () => {
  it.each([
    ["null", null],
    ["an array", []],
    ["a string", "no soy un objeto"],
    ["a number", 7],
  ])("should reject %s as INPUT_INVALID pointing at the root", (_label, data) => {
    const error = captureError(() => validateInputEnvelope(data));

    expect(error.code).toBe("INPUT_INVALID");
    expect(error.paths).toEqual(["$"]);
  });

  it("should reject a wrong schemaVersion", () => {
    const error = captureError(() => validateInputEnvelope(validEnvelope({ schemaVersion: "2.0.0" })));

    expect(error.code).toBe("INPUT_INVALID");
    expect(error.paths).toContain("$.schemaVersion");
  });

  it("should reject an unknown top-level key", () => {
    const error = captureError(() => validateInputEnvelope(validEnvelope({ nefarious: true })));

    expect(error.code).toBe("INPUT_INVALID");
    expect(error.paths).toContain("$.nefarious");
  });
});

describe("validateInputEnvelope — scenarioId", () => {
  it.each([
    ["empty", ""],
    ["longer than the maximum", "a".repeat(LIMITS.MAX_SCENARIO_ID_LENGTH + 1)],
    ["uppercase", "Charge-Card"],
    ["with spaces", "charge card"],
    ["with a path traversal attempt", "../../etc/passwd"],
    ["not a string", 42],
    ["missing", undefined],
  ])("should reject a scenarioId that is %s", (_label, scenarioId) => {
    const error = captureError(() => validateInputEnvelope(validEnvelope({ scenarioId })));

    expect(error.code).toBe("INPUT_INVALID");
    expect(error.paths).toContain("$.scenarioId");
  });
});

describe("validateInputEnvelope — payload", () => {
  it.each([
    ["an array", []],
    ["null", null],
    ["a string", "{}"],
    ["missing", undefined],
  ])("should reject a payload that is %s as INPUT_INVALID", (_label, payload) => {
    const error = captureError(() => validateInputEnvelope(validEnvelope({ payload })));

    expect(error.code).toBe("INPUT_INVALID");
    expect(error.paths).toContain("$.payload");
  });

  it("should reject a payload with more than the maximum top-level properties as LIMIT_EXCEEDED", () => {
    const payload: Record<string, unknown> = {};
    for (let i = 0; i <= LIMITS.MAX_PAYLOAD_PROPERTIES; i += 1) payload[`prop_${i}`] = i;

    const error = captureError(() => validateInputEnvelope(validEnvelope({ payload })));

    expect(error.code).toBe("LIMIT_EXCEEDED");
    expect(error.paths).toEqual(["$.payload"]);
  });

  it("should accept a payload nested exactly at the maximum depth", () => {
    const payload = nestedPayload(LIMITS.MAX_PAYLOAD_DEPTH);

    expect(() => validateInputEnvelope(validEnvelope({ payload }))).not.toThrow();
  });

  it("should reject a payload nested deeper than the maximum depth as LIMIT_EXCEEDED", () => {
    const payload = nestedPayload(LIMITS.MAX_PAYLOAD_DEPTH + 1);

    const error = captureError(() => validateInputEnvelope(validEnvelope({ payload })));

    expect(error.code).toBe("LIMIT_EXCEEDED");
    expect(error.paths).toEqual(["$.payload"]);
  });

  it("should reject deep nesting reached through arrays, not only through objects", () => {
    let value: unknown = 1;
    for (let i = 0; i < LIMITS.MAX_PAYLOAD_DEPTH + 1; i += 1) value = [value];

    const error = captureError(() => validateInputEnvelope(validEnvelope({ payload: { deep: value } })));

    expect(error.code).toBe("LIMIT_EXCEEDED");
  });

  it("should accept a string value exactly at the maximum payload string length", () => {
    const payload = { nota: "a".repeat(LIMITS.MAX_PAYLOAD_STRING_CHARS) };

    expect(() => validateInputEnvelope(validEnvelope({ payload }))).not.toThrow();
  });

  it("should reject a single oversized string value as LIMIT_EXCEEDED even though every other limit passes", () => {
    // Regresión QA: 1 propiedad, profundidad 1 — pasa maxProperties/depth/
    // nodes, pero el valor en sí puede reventar el layout si se renderiza
    // entero (ver src/ui/ConflictDiff.tsx). Debe rechazarse en la capa de
    // validación, no solo truncarse en el render.
    const payload = { nota: "A".repeat(LIMITS.MAX_PAYLOAD_STRING_CHARS + 1) };

    const error = captureError(() => validateInputEnvelope(validEnvelope({ payload })));

    expect(error.code).toBe("LIMIT_EXCEEDED");
    expect(error.paths).toEqual(["$.payload"]);
  });

  it("should reject an oversized string nested inside the payload, not only at the top level", () => {
    const payload = { order: { note: "A".repeat(LIMITS.MAX_PAYLOAD_STRING_CHARS + 1) } };

    const error = captureError(() => validateInputEnvelope(validEnvelope({ payload })));

    expect(error.code).toBe("LIMIT_EXCEEDED");
  });

  it("should report the property limit before any other payload problem", () => {
    // Un payload que supera a la vez el tope de propiedades y la profundidad
    // debe reportarse como LIMIT_EXCEEDED (más específico), nunca degradarse
    // a un INPUT_INVALID genérico.
    const payload: Record<string, unknown> = { deep: nestedPayload(LIMITS.MAX_PAYLOAD_DEPTH + 5) };
    for (let i = 0; i <= LIMITS.MAX_PAYLOAD_PROPERTIES; i += 1) payload[`prop_${i}`] = i;

    const error = captureError(() => validateInputEnvelope(validEnvelope({ payload })));

    expect(error.code).toBe("LIMIT_EXCEEDED");
  });
});

describe("validateInputEnvelope — options", () => {
  it.each([
    ["missing", undefined],
    ["null", null],
    ["an array", []],
    ["a boolean", true],
  ])("should reject options that are %s", (_label, options) => {
    const error = captureError(() => validateInputEnvelope(validEnvelope({ options })));

    expect(error.code).toBe("INPUT_INVALID");
    expect(error.paths).toContain("$.options");
  });

  it("should reject a non-boolean deterministic flag", () => {
    const error = captureError(() =>
      validateInputEnvelope(validEnvelope({ options: { deterministic: "true" } }))
    );

    expect(error.code).toBe("INPUT_INVALID");
    expect(error.paths).toContain("$.options.deterministic");
  });

  it("should reject an unknown key inside options", () => {
    const error = captureError(() =>
      validateInputEnvelope(validEnvelope({ options: { deterministic: true, retries: 3 } }))
    );

    expect(error.code).toBe("INPUT_INVALID");
    expect(error.paths).toContain("$.options.retries");
  });

  it("should report every invalid path at once so the UI can point at all of them", () => {
    const error = captureError(() =>
      validateInputEnvelope({
        schemaVersion: "0.9.0",
        scenarioId: "INVALID",
        payload: [],
        options: { deterministic: 1 },
      })
    );

    expect(error.paths).toEqual(
      expect.arrayContaining(["$.schemaVersion", "$.scenarioId", "$.payload", "$.options.deterministic"])
    );
  });

  it("should never leak payload values through the reported paths", () => {
    const error = captureError(() =>
      validateInputEnvelope(validEnvelope({ scenarioId: "BAD", payload: { secretToken: "s3cr3t" } }))
    );

    expect(error.paths?.join(" ")).not.toContain("s3cr3t");
    expect(error.message).not.toContain("s3cr3t");
  });
});

describe("parsePayloadText", () => {
  it("should parse valid JSON into a plain value", () => {
    expect(parsePayloadText('{"a":1,"b":[2,3]}')).toEqual({ a: 1, b: [2, 3] });
  });

  it("should throw INPUT_INVALID on malformed JSON", () => {
    const error = captureError(() => parsePayloadText('{ "orderId": "ord_broken", amountCents: 999 }'));

    expect(error.code).toBe("INPUT_INVALID");
    expect(error.paths).toEqual(["$"]);
  });

  it("should reject JavaScript that is not JSON, proving it uses JSON.parse and never eval", () => {
    // Estas tres cadenas son JavaScript perfectamente evaluable pero NO son
    // JSON: si el parser usara eval/Function, devolverían un valor en lugar
    // de lanzar. Es la prueba de regresión de "nunca ejecutar código pegado"
    // (08-seguridad-privacidad.md).
    for (const source of ["1+1", "{a:1}", "(function(){ return 1 })()"]) {
      expect(captureError(() => parsePayloadText(source)).code).toBe("INPUT_INVALID");
    }
  });

  it("should throw LIMIT_EXCEEDED when the text exceeds the maximum input size", () => {
    const text = `"${"a".repeat(LIMITS.MAX_INPUT_TEXT_CHARS)}"`;

    const error = captureError(() => parsePayloadText(text));

    expect(error.code).toBe("LIMIT_EXCEEDED");
    expect(error.paths).toEqual(["$"]);
  });

  it("should accept text exactly at the maximum input size", () => {
    const filler = "a".repeat(LIMITS.MAX_INPUT_TEXT_CHARS - 2);
    const text = `"${filler}"`;

    expect(text.length).toBe(LIMITS.MAX_INPUT_TEXT_CHARS);
    expect(() => parsePayloadText(text)).not.toThrow();
  });
});
