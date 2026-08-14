/**
 * Prueba de regresión del riesgo #1 del producto (08-seguridad-privacidad.md,
 * fila "confundir idempotencia con exactly-once"): ningún texto que salga del
 * dominio puede prometer garantías que este simulador no puede dar.
 *
 * La prueba es deliberadamente amplia: recorre TODAS las exportaciones de
 * copy.ts (para que una constante nueva quede cubierta automáticamente sin
 * tocar este archivo) y además todos los textos que las reglas generan en
 * tiempo de ejecución, que es donde se interpolan datos y donde una
 * redacción nueva podría colarse.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as copy from "../../src/domain/copy";
import {
  ruleConcurrentGuard,
  ruleDependencyFallback,
  ruleExpiredKey,
  ruleFirstExecution,
  ruleKeyConflict,
  ruleRetryHit,
  type RuleResult,
} from "../../src/domain/rules";

/**
 * Raíces prohibidas, en minúsculas. "garantiz" cubre garantizado/garantía
 * verbal/garantizar; "certific" cubre certificado/certificación/certificar.
 */
const FORBIDDEN_STEMS = ["garantiz", "certific", "100% seguro", "nunca falla"];

const RULE_RESULTS: RuleResult[] = [
  ruleFirstExecution(),
  ruleRetryHit(),
  ruleConcurrentGuard(),
  ruleExpiredKey(),
  ruleDependencyFallback(),
  ruleKeyConflict({ differing: ["amountCents"], onlyInIncoming: ["coupon"], onlyInStored: ["note"] }),
  ruleKeyConflict({ differing: [], onlyInIncoming: [], onlyInStored: [] }),
];

/** Toda cadena que el dominio puede mostrar a un visitante, con una etiqueta
 * que identifica su origen para que un fallo señale la constante culpable. */
function allDomainStrings(): Array<{ source: string; text: string }> {
  const entries: Array<{ source: string; text: string }> = [];

  for (const [name, value] of Object.entries(copy)) {
    if (typeof value === "string") entries.push({ source: `copy.${name}`, text: value });
  }

  RULE_RESULTS.forEach((result, index) => {
    const label = `${result.transitionKind}[${index}]`;
    entries.push({ source: `${label}.explanation`, text: result.explanation });
    result.assumptions.forEach((assumption, i) =>
      entries.push({ source: `${label}.assumptions[${i}]`, text: assumption })
    );
    result.findings.forEach((finding) => {
      entries.push({ source: `${label}.${finding.ruleId}.message`, text: finding.message });
      if (finding.suggestion) {
        entries.push({ source: `${label}.${finding.ruleId}.suggestion`, text: finding.suggestion });
      }
    });
  });

  return entries;
}

describe("lenguaje del dominio", () => {
  it("should actually collect strings from copy.ts, so the ban below is not vacuous", () => {
    const fromCopy = allDomainStrings().filter((e) => e.source.startsWith("copy."));

    expect(fromCopy.length).toBeGreaterThanOrEqual(7);
    expect(Object.keys(copy).length).toBe(fromCopy.length);
  });

  it("should collect the runtime-generated rule texts too, not only the constants", () => {
    const fromRules = allDomainStrings().filter((e) => !e.source.startsWith("copy."));

    expect(fromRules.length).toBeGreaterThanOrEqual(RULE_RESULTS.length * 3);
  });

  it.each(FORBIDDEN_STEMS)(
    "should never use certification-flavoured language containing %j",
    (stem) => {
      const offenders = allDomainStrings().filter((entry) => entry.text.toLowerCase().includes(stem));

      expect(offenders.map((o) => o.source)).toEqual([]);
    }
  );

  it("should never claim exactly-once delivery as something this simulator provides", () => {
    const offenders = allDomainStrings().filter((entry) =>
      /exactly-once (garantizad|asegurad|comprobad)/i.test(entry.text)
    );

    expect(offenders.map((o) => o.source)).toEqual([]);
  });
});

describe("IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER", () => {
  it("should exist and be non-empty", () => {
    expect(typeof copy.IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER).toBe("string");
    expect(copy.IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER.trim().length).toBeGreaterThan(0);
  });

  it("should draw the distinction explicitly, naming both concepts", () => {
    const text = copy.IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER.toLowerCase();

    expect(text).toContain("idempotencia");
    expect(text).toContain("exactly-once");
  });

  it("should be surfaced on the retry path, which is exactly where the confusion happens", () => {
    // Un visitante que ve "mismo resultado devuelto" es quien más fácilmente
    // concluye "entonces esto garantiza exactly-once": el aviso tiene que
    // viajar con ese mensaje concreto, no vivir solo en una página aparte.
    expect(copy.RETRY_HIT_EXPLANATION).toContain(copy.IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER);
    expect(ruleRetryHit().findings[0]?.message).toContain(copy.IDEMPOTENCE_VS_EXACTLY_ONCE_DISCLAIMER);
  });
});

/**
 * Regresión QA (hallazgo MEDIO #4): la copy DEL DOMINIO (copy.ts) ya lleva
 * el matiz de "idempotencia observada, no exactly-once garantizado" viajando
 * junto a cada explicación. Pero la lista-resumen de "Cómo funciona" en la
 * UI (src/ui/HowItWorks.tsx) la restataba sin ese matiz — y es lo primero
 * que un visitante lee, antes de abrir cualquier detalle expandible. Se lee
 * el archivo fuente directamente (en vez de renderizar el componente) para
 * poder aplicarle el mismo escaneo de raíces prohibidas que al resto del
 * lenguaje del dominio, y para que una futura edición que borre el matiz
 * quede atrapada aquí sin depender de que alguien recuerde actualizar este
 * test a mano.
 */
const HOW_IT_WORKS_SOURCE = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src/ui/HowItWorks.tsx"),
  "utf-8"
);

/** El JSX envuelve las líneas largas, así que dos palabras "adyacentes" en
 * el texto renderizado pueden estar separadas por un salto de línea y
 * espacios de indentación en el archivo fuente. Se colapsa cualquier
 * secuencia de espacio en blanco a un único espacio antes de buscar, para
 * que las aserciones no dependan de dónde decida envolver el formateador. */
const HOW_IT_WORKS_NORMALIZED = HOW_IT_WORKS_SOURCE.replace(/\s+/g, " ");

describe("HowItWorks — el resumen de la UI no puede prometer más que el dominio", () => {
  it("should keep the caveat on the 'Reintento' rule (retry-hit only holds inside this local simulator)", () => {
    expect(HOW_IT_WORKS_NORMALIZED).toMatch(/Reintento\.<\/strong>.{0,400}en este simulador local/);
  });

  it("should keep the caveat on the 'Expiración' rule (local reset says nothing about a real upstream system)", () => {
    expect(HOW_IT_WORKS_NORMALIZED).toMatch(
      /Expiración\.<\/strong>.{0,400}aguas arriba en un sistema real/
    );
  });

  it("should never use certification-flavoured language in the UI's own copy either", () => {
    const lower = HOW_IT_WORKS_SOURCE.toLowerCase();
    const offenders = FORBIDDEN_STEMS.filter((stem) => lower.includes(stem));

    expect(offenders).toEqual([]);
  });

  it("should keep the exactly-once disclaimer directly below the four-rule list, adjacent to what it disclaims", () => {
    const rulesListEnd = HOW_IT_WORKS_SOURCE.indexOf("</ul>");
    const disclaimerStart = HOW_IT_WORKS_SOURCE.indexOf("how-disclaimer");
    const nextSectionStart = HOW_IT_WORKS_SOURCE.indexOf("<h3>Arquitectura");

    expect(rulesListEnd).toBeGreaterThan(-1);
    expect(disclaimerStart).toBeGreaterThan(rulesListEnd);
    expect(disclaimerStart).toBeLessThan(nextSectionStart);
  });
});

describe("lenguaje de supuestos y límites", () => {
  it("should frame the concurrency rule as a simulated race, not as real multi-thread concurrency", () => {
    expect(copy.CONCURRENT_GUARD_EXPLANATION.toLowerCase()).toContain("simulada");
  });

  it("should frame the expiry rule as a local limitation", () => {
    expect(copy.EXPIRED_KEY_EXPLANATION.toLowerCase()).toContain("límite conocido");
  });

  it("should state that the conflict path never overwrites the stored result", () => {
    expect(copy.CONFLICT_EXPLANATION.toLowerCase()).toContain("no se sobrescribe");
  });
});
