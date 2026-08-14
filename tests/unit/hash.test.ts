/**
 * Unitarias de src/domain/hash.ts.
 *
 * Riesgo cubierto: si la serialización canónica no fuera estable, "mismo
 * payload en distinto orden de claves" produciría huellas distintas y el
 * motor lo trataría como conflicto en lugar de retry-hit (P5-R2).
 */
import { describe, expect, it } from "vitest";
import { canonicalStringify, fingerprint, generateRunId } from "../../src/domain/hash";
import { LIMITS } from "../../src/domain/limits";

/** Restricciones de contracts/output.schema.json para `runId`. */
const RUN_ID_MIN_LENGTH = 1;
const RUN_ID_MAX_LENGTH = 100;

describe("canonicalStringify", () => {
  it("should produce identical output for objects whose keys were written in a different order", () => {
    const a = { orderId: "ord_1", amountCents: 4599, currency: "EUR" };
    const b = { currency: "EUR", amountCents: 4599, orderId: "ord_1" };

    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("should sort keys recursively, not only at the top level", () => {
    const a = { outer: { z: 1, a: { y: true, b: "x" } } };
    const b = { outer: { a: { b: "x", y: true }, z: 1 } };

    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it("should preserve array order, because array order is semantically meaningful", () => {
    expect(canonicalStringify({ items: [1, 2, 3] })).not.toBe(canonicalStringify({ items: [3, 2, 1] }));
  });

  it("should omit undefined object properties, matching JSON.stringify semantics", () => {
    expect(canonicalStringify({ a: 1, b: undefined })).toBe(canonicalStringify({ a: 1 }));
  });

  it("should serialize undefined array items as null, matching JSON.stringify semantics", () => {
    expect(canonicalStringify({ items: [1, undefined, 3] })).toBe('{"items":[1,null,3]}');
  });

  it("should serialize null and primitive roots without throwing", () => {
    expect(canonicalStringify(null)).toBe("null");
    expect(canonicalStringify(undefined)).toBe("null");
    expect(canonicalStringify(42)).toBe("42");
    expect(canonicalStringify("hola")).toBe('"hola"');
    expect(canonicalStringify(true)).toBe("true");
  });
});

describe("fingerprint", () => {
  it("should return the same hash for the same payload across repeated calls", async () => {
    const payload = { orderId: "ord_7f3e", amountCents: 4599 };

    const first = await fingerprint(payload);
    const second = await fingerprint(payload);

    expect(first).toBe(second);
  });

  it("should return the same hash regardless of key insertion order", async () => {
    const first = await fingerprint({ a: 1, b: 2 });
    const second = await fingerprint({ b: 2, a: 1 });

    expect(first).toBe(second);
  });

  it("should return a different hash when any value changes", async () => {
    const base = await fingerprint({ orderId: "ord_7f3e", amountCents: 4599 });

    expect(await fingerprint({ orderId: "ord_7f3e", amountCents: 4600 })).not.toBe(base);
    expect(await fingerprint({ orderId: "ord_7f3f", amountCents: 4599 })).not.toBe(base);
  });

  it("should return a different hash when a key is added or removed", async () => {
    const base = await fingerprint({ a: 1 });

    expect(await fingerprint({ a: 1, b: 2 })).not.toBe(base);
    expect(await fingerprint({})).not.toBe(base);
  });

  it("should distinguish the number 1 from the string \"1\"", async () => {
    expect(await fingerprint({ a: 1 })).not.toBe(await fingerprint({ a: "1" }));
  });

  it("should return 16 lowercase hex characters", async () => {
    expect(await fingerprint({ a: 1 })).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("generateRunId", () => {
  it("should embed the scenarioId so a runId can be traced back to its scenario", () => {
    expect(generateRunId("charge-card")).toContain("charge-card");
  });

  it("should respect the runId length constraints of contracts/output.schema.json", () => {
    const scenarioIds = ["a", "charge-card", "x".repeat(LIMITS.MAX_SCENARIO_ID_LENGTH)];

    for (const scenarioId of scenarioIds) {
      const runId = generateRunId(scenarioId);
      expect(runId.length).toBeGreaterThanOrEqual(RUN_ID_MIN_LENGTH);
      expect(runId.length).toBeLessThanOrEqual(RUN_ID_MAX_LENGTH);
    }
  });

  it("should produce a distinct runId on each call for the same scenario", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateRunId("charge-card")));

    expect(ids.size).toBe(50);
  });
});
