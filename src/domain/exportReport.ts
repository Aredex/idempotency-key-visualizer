/**
 * Construcción del reporte exportable (JSON o Markdown) de una ejecución.
 * Ver 06-modelo-datos.md. El payload crudo del visitante NUNCA se incluye
 * salvo que lo pida explícitamente (`opts.includePayload`), y aun así pasa
 * primero por `redact` — nunca se exporta un secreto reconocible por nombre
 * de campo sin más.
 */
import { LIMITS } from "./limits";
import { EngineError } from "./types";
import type { EngineState, ExportReport, RecordState } from "./types";

const REDACTED = "«redactado»";
const DEFAULT_DENYLIST = /email|token|secret|password|authorization|card|cvv/i;

/** Clona profundamente `payload`, sustituyendo el valor de cualquier clave
 * cuyo nombre coincida con `denylist` por el literal REDACTED. */
export function redact(
  payload: Record<string, unknown>,
  denylist: RegExp = DEFAULT_DENYLIST
): Record<string, unknown> {
  return redactValue(payload, denylist) as Record<string, unknown>;
}

function redactValue(value: unknown, denylist: RegExp): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, denylist));
  }
  if (typeof value === "object" && value !== null) {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      out[key] = denylist.test(key) ? REDACTED : redactValue(source[key], denylist);
    }
    return out;
  }
  return value;
}

export function buildExportReport(
  state: EngineState,
  key: string,
  opts: { includePayload: boolean }
): ExportReport {
  const record: RecordState | undefined = state.records[key];
  const relatedTransitions = state.transitions.filter((t) => t.runId === record?.storedOutput?.runId);

  const status = record?.storedOutput?.status ?? "failed";
  const summary = record?.storedOutput?.summary ?? `No hay ninguna ejecución registrada para la clave "${key}".`;
  const findings = record?.storedOutput?.findings ?? [];
  const scenarioId = record?.storedOutput?.evidence.scenarioId ?? key;
  const rulesVersion = record?.storedOutput?.evidence.rulesVersion ?? "1.0.0";

  const report: ExportReport = {
    runId: record?.storedOutput?.runId ?? "",
    generatedAt: new Date().toISOString(), // metadata de la exportación en sí, no del motor determinista
    rulesVersion,
    scenarioId,
    recordKey: key,
    status,
    summary,
    payloadFingerprint: record?.fingerprint ?? "",
    findings,
    transitions: relatedTransitions.map((t) => ({
      kind: t.kind,
      explanation: t.explanation,
      assumptions: t.assumptions,
      confidence: t.confidence,
    })),
    assumptions: relatedTransitions.flatMap((t) => t.assumptions),
  };

  if (opts.includePayload && record?.storedPayload) {
    report.includedPayload = redact(record.storedPayload);
  }

  return report;
}

function assertWithinExportBudget(bytes: number): void {
  if (bytes > LIMITS.MAX_EXPORT_BYTES) {
    throw new EngineError({
      code: "LIMIT_EXCEEDED",
      message: `La exportación generada (${bytes} bytes) supera el máximo permitido de ${LIMITS.MAX_EXPORT_BYTES} bytes.`,
    });
  }
}

export function toJson(report: ExportReport): string {
  const json = JSON.stringify(report, null, 2);
  assertWithinExportBudget(new TextEncoder().encode(json).length);
  return json;
}

export function toMarkdown(report: ExportReport): string {
  const lines: string[] = [
    `# Reporte de idempotencia — ${report.recordKey}`,
    "",
    `- **runId**: \`${report.runId || "(sin ejecución registrada)"}\``,
    `- **generado**: ${report.generatedAt}`,
    `- **rulesVersion**: ${report.rulesVersion}`,
    `- **scenarioId**: ${report.scenarioId}`,
    `- **status**: ${report.status}`,
    `- **huella del payload**: \`${report.payloadFingerprint || "(ninguna)"}\``,
    "",
    "## Resumen",
    "",
    report.summary,
    "",
    "## Hallazgos",
    "",
  ];

  if (report.findings.length === 0) {
    lines.push("_Sin hallazgos._");
  } else {
    for (const finding of report.findings) {
      lines.push(`- **[${finding.severity}] ${finding.ruleId}** — ${finding.message}`);
      if (finding.suggestion) lines.push(`  - Sugerencia: ${finding.suggestion}`);
    }
  }

  lines.push("", "## Transiciones", "");
  if (report.transitions.length === 0) {
    lines.push("_Sin transiciones registradas._");
  } else {
    for (const transition of report.transitions) {
      lines.push(`- **${transition.kind}** (confianza: ${transition.confidence}) — ${transition.explanation}`);
    }
  }

  lines.push("", "## Supuestos", "");
  const uniqueAssumptions = [...new Set(report.assumptions)];
  if (uniqueAssumptions.length === 0) {
    lines.push("_Sin supuestos registrados._");
  } else {
    for (const assumption of uniqueAssumptions) lines.push(`- ${assumption}`);
  }

  if (report.includedPayload) {
    lines.push("", "## Payload (redactado)", "", "```json", JSON.stringify(report.includedPayload, null, 2), "```");
  }

  const markdown = lines.join("\n");
  assertWithinExportBudget(new TextEncoder().encode(markdown).length);
  return markdown;
}
