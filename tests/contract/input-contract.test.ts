/**
 * Contrato de entrada: contracts/input.schema.json.
 *
 * Dos objetivos:
 *  1. Que los fixtures reales (SCENARIOS) sigan siendo entradas válidas.
 *  2. Anti-deriva: que el validador escrito a mano (src/domain/envelope.ts)
 *     y el schema JSON den el MISMO veredicto sobre la misma batería de
 *     casos. Sin esta prueba, tocar uno de los dos y olvidar el otro pasaría
 *     desapercibido hasta producción.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { ValidateFunction } from "ajv/dist/2020";
import { compile, inputSchema } from "./schemas";
import { validateInputEnvelope } from "../../src/domain/envelope";
import { LIMITS } from "../../src/domain/limits";
import { SCENARIOS } from "../../src/domain/fixtures/scenarios";

let validate: ValidateFunction;

beforeAll(() => {
  validate = compile(inputSchema);
});

function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0",
    scenarioId: "charge-card",
    payload: { orderId: "ord_1" },
    options: { deterministic: true },
    ...overrides,
  };
}

function propertiesPayload(count: number): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (let i = 0; i < count; i += 1) payload[`prop_${i}`] = i;
  return payload;
}

/** Casos que el schema JSON expresa por sí mismo, y sobre los que por tanto
 * ajv y el validador manual deben coincidir exactamente. */
const SHARED_CASES: Array<{ name: string; data: unknown; valid: boolean }> = [
  { name: "envolvente bien formada", data: envelope(), valid: true },
  { name: "payload vacío", data: envelope({ payload: {} }), valid: true },
  { name: "deterministic:false", data: envelope({ options: { deterministic: false } }), valid: true },
  {
    name: "payload exactamente en el límite de propiedades",
    data: envelope({ payload: propertiesPayload(LIMITS.MAX_PAYLOAD_PROPERTIES) }),
    valid: true,
  },
  {
    name: "scenarioId exactamente en la longitud máxima",
    data: envelope({ scenarioId: "a".repeat(LIMITS.MAX_SCENARIO_ID_LENGTH) }),
    valid: true,
  },
  { name: "scenarioId con dígitos y guiones", data: envelope({ scenarioId: "escenario-42" }), valid: true },

  { name: "raíz nula", data: null, valid: false },
  { name: "raíz array", data: [], valid: false },
  { name: "raíz string", data: "no", valid: false },
  { name: "schemaVersion incorrecta", data: envelope({ schemaVersion: "2.0.0" }), valid: false },
  { name: "schemaVersion ausente", data: { ...envelope(), schemaVersion: undefined }, valid: false },
  { name: "clave de nivel superior desconocida", data: envelope({ extra: 1 }), valid: false },
  { name: "scenarioId vacío", data: envelope({ scenarioId: "" }), valid: false },
  { name: "scenarioId en mayúsculas", data: envelope({ scenarioId: "Charge-Card" }), valid: false },
  { name: "scenarioId con guion bajo", data: envelope({ scenarioId: "charge_card" }), valid: false },
  { name: "scenarioId con espacios", data: envelope({ scenarioId: "charge card" }), valid: false },
  {
    name: "scenarioId más largo que el máximo",
    data: envelope({ scenarioId: "a".repeat(LIMITS.MAX_SCENARIO_ID_LENGTH + 1) }),
    valid: false,
  },
  { name: "scenarioId no string", data: envelope({ scenarioId: 7 }), valid: false },
  { name: "payload array", data: envelope({ payload: [] }), valid: false },
  { name: "payload string", data: envelope({ payload: "{}" }), valid: false },
  { name: "payload ausente", data: { ...envelope(), payload: undefined }, valid: false },
  {
    name: "payload por encima del límite de propiedades",
    data: envelope({ payload: propertiesPayload(LIMITS.MAX_PAYLOAD_PROPERTIES + 1) }),
    valid: false,
  },
  { name: "options ausente", data: { ...envelope(), options: undefined }, valid: false },
  { name: "options array", data: envelope({ options: [] }), valid: false },
  { name: "options sin deterministic", data: envelope({ options: {} }), valid: false },
  {
    name: "deterministic no booleano",
    data: envelope({ options: { deterministic: "true" } }),
    valid: false,
  },
  {
    name: "clave desconocida dentro de options",
    data: envelope({ options: { deterministic: true, retries: 3 } }),
    valid: false,
  },
];

describe("contracts/input.schema.json", () => {
  it("should compile as a JSON Schema 2020-12 document in strict mode", () => {
    expect(typeof validate).toBe("function");
  });

  it.each(SCENARIOS.map((s) => [s.id, s] as const))(
    "should accept the shipped fixture %s wrapped as a full envelope",
    (_id, scenario) => {
      const data = {
        schemaVersion: "1.0.0",
        scenarioId: scenario.id,
        payload: scenario.initialPayload,
        options: { deterministic: true },
      };

      expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
    }
  );

  it("should accept every shipped fixture through the hand-written validator too", () => {
    for (const scenario of SCENARIOS) {
      expect(() =>
        validateInputEnvelope({
          schemaVersion: "1.0.0",
          scenarioId: scenario.id,
          payload: scenario.initialPayload,
          options: { deterministic: true },
        })
      ).not.toThrow();
    }
  });

  it("should reject a payload with 201 top-level properties via maxProperties", () => {
    expect(validate(envelope({ payload: propertiesPayload(201) }))).toBe(false);
    expect(validate.errors?.some((e) => e.keyword === "maxProperties")).toBe(true);
  });

  it("should reject an unknown top-level key via additionalProperties:false", () => {
    expect(validate(envelope({ nefarious: true }))).toBe(false);
    expect(validate.errors?.some((e) => e.keyword === "additionalProperties")).toBe(true);
  });

  it("should reject an uppercase scenarioId via the pattern", () => {
    expect(validate(envelope({ scenarioId: "Charge-Card" }))).toBe(false);
    expect(validate.errors?.some((e) => e.keyword === "pattern")).toBe(true);
  });
});

describe("anti-deriva: ajv vs. validador escrito a mano", () => {
  it.each(SHARED_CASES.map((c) => [c.name, c] as const))("should agree on: %s", (_name, testCase) => {
    const ajvSaysValid = validate(testCase.data);

    let handWrittenSaysValid = true;
    try {
      validateInputEnvelope(testCase.data);
    } catch {
      handWrittenSaysValid = false;
    }

    expect(ajvSaysValid, `ajv: ${JSON.stringify(validate.errors)}`).toBe(testCase.valid);
    expect(handWrittenSaysValid).toBe(testCase.valid);
  });

  it("should exercise both verdicts, so the agreement above is not vacuously one-sided", () => {
    expect(SHARED_CASES.filter((c) => c.valid).length).toBeGreaterThan(0);
    expect(SHARED_CASES.filter((c) => !c.valid).length).toBeGreaterThan(0);
  });
});

describe("restricciones deliberadamente MÁS estrictas que el schema", () => {
  // El schema JSON no puede expresar profundidad ni número de nodos. El
  // validador manual sí las aplica (08-seguridad-privacidad.md exige límites
  // de profundidad/tamaño/cantidad/tiempo), así que aquí la divergencia es
  // intencionada y se documenta como tal en lugar de tratarse como deriva.
  it("should let ajv accept a deeply nested payload that the engine rejects as LIMIT_EXCEEDED", () => {
    let deep: unknown = 1;
    for (let i = 0; i < LIMITS.MAX_PAYLOAD_DEPTH + 2; i += 1) deep = { level: deep };
    const data = envelope({ payload: deep as Record<string, unknown> });

    expect(validate(data)).toBe(true);
    expect(() => validateInputEnvelope(data)).toThrow(/profundidad/i);
  });

  it("should let ajv accept a payload with an oversized single string value that the engine rejects as LIMIT_EXCEEDED", () => {
    // El schema JSON no expresa maxLength sobre valores arbitrarios del
    // payload (serían infinitos campos posibles); el validador manual sí lo
    // aplica (QA · hallazgo MEDIO #3: un string desmesurado revienta el
    // layout del diff de conflicto si no se limita en algún punto).
    const data = envelope({ payload: { nota: "A".repeat(LIMITS.MAX_PAYLOAD_STRING_CHARS + 1) } });

    expect(validate(data)).toBe(true);
    expect(() => validateInputEnvelope(data)).toThrow(/texto|caracteres/i);
  });
});
