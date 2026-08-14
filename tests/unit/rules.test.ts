/**
 * Unitarias de src/domain/rules.ts.
 *
 * Cada regla es la especificación de una decisión del motor: su `ruleId`,
 * `severity` y `confidence` forman parte del contrato que consume la UI (y
 * el reporte exportado), así que se fijan aquí explícitamente. Además se
 * comprueba que ningún texto generado supera los límites de longitud de
 * contracts/output.schema.json.
 */
import { describe, expect, it } from "vitest";
import {
  diffTopLevelKeys,
  ruleConcurrentGuard,
  ruleDependencyFallback,
  ruleExpiredKey,
  ruleFirstExecution,
  ruleKeyConflict,
  ruleRetryHit,
  type PayloadKeyDiff,
  type RuleResult,
} from "../../src/domain/rules";

/** Límites de contracts/output.schema.json para los campos de un Finding. */
const MAX_MESSAGE_LENGTH = 1000;
const MAX_SUGGESTION_LENGTH = 2000;

const EMPTY_DIFF: PayloadKeyDiff = { onlyInStored: [], onlyInIncoming: [], differing: [] };

const ALL_RULES: Array<{
  name: string;
  build: () => RuleResult;
  ruleId: string;
  severity: string;
  confidence: string;
}> = [
  {
    name: "ruleFirstExecution",
    build: ruleFirstExecution,
    ruleId: "IDEMP_FIRST_EXECUTION",
    severity: "info",
    confidence: "high",
  },
  {
    name: "ruleRetryHit",
    build: ruleRetryHit,
    ruleId: "IDEMP_RETRY_HIT",
    severity: "info",
    confidence: "high",
  },
  {
    name: "ruleKeyConflict",
    build: () => ruleKeyConflict(EMPTY_DIFF),
    ruleId: "IDEMP_KEY_CONFLICT",
    severity: "critical",
    confidence: "high",
  },
  {
    name: "ruleConcurrentGuard",
    build: ruleConcurrentGuard,
    ruleId: "IDEMP_CONCURRENT_GUARD",
    severity: "warning",
    confidence: "medium",
  },
  {
    name: "ruleExpiredKey",
    build: ruleExpiredKey,
    ruleId: "IDEMP_EXPIRED_KEY",
    severity: "warning",
    confidence: "medium",
  },
  {
    name: "ruleDependencyFallback",
    build: ruleDependencyFallback,
    ruleId: "IDEMP_DEPENDENCY_FALLBACK",
    severity: "warning",
    confidence: "high",
  },
];

describe.each(ALL_RULES)("$name", ({ build, ruleId, severity, confidence }) => {
  it("should emit exactly one finding with the documented ruleId and severity", () => {
    const result = build();

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe(ruleId);
    expect(result.findings[0]?.severity).toBe(severity);
  });

  it("should report the documented confidence level", () => {
    expect(build().confidence).toBe(confidence);
  });

  it("should provide a non-empty explanation and at least one stated assumption", () => {
    const result = build();

    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.assumptions.every((a) => a.trim().length > 0)).toBe(true);
  });

  it("should use its own transitionKind consistently with its ruleId", () => {
    const result = build();

    expect(result.transitionKind).toBe(
      {
        IDEMP_FIRST_EXECUTION: "first-execution",
        IDEMP_RETRY_HIT: "retry-hit",
        IDEMP_KEY_CONFLICT: "conflict",
        IDEMP_CONCURRENT_GUARD: "concurrent-guard",
        IDEMP_EXPIRED_KEY: "expired-key",
        IDEMP_DEPENDENCY_FALLBACK: "dependency-fallback",
      }[ruleId]
    );
  });

  it("should keep every finding message and suggestion within the output schema limits", () => {
    for (const finding of build().findings) {
      expect(finding.message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
      expect(finding.suggestion?.length ?? 0).toBeLessThanOrEqual(MAX_SUGGESTION_LENGTH);
    }
  });
});

describe("ruleKeyConflict", () => {
  it("should be the only rule that attaches an actionable suggestion", () => {
    const withSuggestion = ALL_RULES.filter(({ build }) => build().findings.some((f) => f.suggestion));

    expect(withSuggestion.map((r) => r.ruleId)).toEqual(["IDEMP_KEY_CONFLICT"]);
  });

  it("should name the differing, added and missing top-level keys", () => {
    const result = ruleKeyConflict({
      differing: ["amountCents"],
      onlyInIncoming: ["coupon"],
      onlyInStored: ["note"],
    });

    expect(result.explanation).toContain("amountCents");
    expect(result.explanation).toContain("coupon");
    expect(result.explanation).toContain("note");
  });

  it("should stay within the message length limit even with a very wide structural diff", () => {
    const manyKeys = Array.from({ length: 200 }, (_, i) => `campo_larguisimo_numero_${i}`);

    const result = ruleKeyConflict({ differing: manyKeys, onlyInIncoming: [], onlyInStored: [] });

    // El motor recorta el summary a 500 caracteres, pero el message del
    // finding es el que viaja en el contrato de salida: si esta aserción
    // falla, el reporte generado violaría output.schema.json.
    expect(result.findings[0]?.message.length).toBeLessThanOrEqual(MAX_MESSAGE_LENGTH);
  });

  it("should omit the structural note entirely when there is nothing to report", () => {
    expect(ruleKeyConflict(EMPTY_DIFF).explanation).not.toContain("(");
  });
});

describe("diffTopLevelKeys", () => {
  it("should classify keys as differing, only-in-incoming or only-in-stored", () => {
    const diff = diffTopLevelKeys(
      { same: 1, changed: "a", removed: true },
      { same: 1, changed: "b", added: 9 }
    );

    expect(diff).toEqual({ differing: ["changed"], onlyInIncoming: ["added"], onlyInStored: ["removed"] });
  });

  it("should return empty lists for identical payloads", () => {
    expect(diffTopLevelKeys({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] })).toEqual(EMPTY_DIFF);
  });

  it("should sort every list so the reported diff is deterministic", () => {
    const diff = diffTopLevelKeys({ z: 1, a: 1 }, { m: 1, b: 1 });

    expect(diff.onlyInStored).toEqual(["a", "z"]);
    expect(diff.onlyInIncoming).toEqual(["b", "m"]);
  });

  it("should detect a nested change under an otherwise identical top-level key", () => {
    const diff = diffTopLevelKeys({ meta: { attempt: 1 } }, { meta: { attempt: 2 } });

    expect(diff.differing).toEqual(["meta"]);
  });

  it("should handle empty payloads on either side", () => {
    expect(diffTopLevelKeys({}, { a: 1 }).onlyInIncoming).toEqual(["a"]);
    expect(diffTopLevelKeys({ a: 1 }, {}).onlyInStored).toEqual(["a"]);
  });
});
