/**
 * Traducciones/etiquetas de UI para los enums del dominio. Centralizadas
 * aquí para que ningún componente invente su propia redacción para el mismo
 * valor (p. ej. dos textos distintos para severity "critical").
 */
import type { Confidence, DecisionKind, RunStatus, Severity } from "../domain/types";

export const STATUS_LABELS: Record<RunStatus, string> = {
  completed: "Completado",
  partial: "Parcial",
  failed: "Fallido",
  cancelled: "Cancelado",
};

export const STATUS_BADGE_VARIANT: Record<RunStatus, "info" | "warning" | "error" | "critical"> = {
  completed: "info",
  partial: "warning",
  failed: "error",
  cancelled: "warning",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Información",
  warning: "Advertencia",
  error: "Error",
  critical: "Crítico",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "Confianza: alta",
  medium: "Confianza: media",
  low: "Confianza: baja",
};

export const DECISION_LABELS: Record<DecisionKind, string> = {
  "first-execution": "Primera ejecución",
  "retry-hit": "Reintento — mismo resultado",
  conflict: "Conflicto de clave",
  "concurrent-guard": "Guarda de concurrencia",
  "expired-key": "Clave expirada",
  "input-invalid": "Entrada inválida",
  "limit-exceeded": "Límite superado",
  cancelled: "Cancelado",
  "dependency-fallback": "Fallback de dependencia",
};

/**
 * Categoría "Resultado" exigida por la IA del producto (sin hallazgos /
 * advertencias / crítico / parcial), derivada de status + severidad de los
 * findings. No es lo mismo que RunStatus: dos ejecuciones "failed" pueden
 * caer aquí igualmente en "crítico" (conflicto, límite superado, entrada
 * inválida), y una "completed" sin hallazgos de riesgo cae en "sin hallazgos".
 */
export type ResultCategory = "sin-hallazgos" | "advertencias" | "critico" | "parcial";

export const RESULT_CATEGORY_LABELS: Record<ResultCategory, string> = {
  "sin-hallazgos": "Sin hallazgos",
  advertencias: "Advertencias",
  critico: "Crítico",
  parcial: "Parcial",
};

export const RESULT_CATEGORY_VARIANT: Record<ResultCategory, "info" | "warning" | "error" | "critical"> = {
  "sin-hallazgos": "info",
  advertencias: "warning",
  critico: "critical",
  parcial: "warning",
};

export function resultCategory(status: RunStatus, findings: { severity: Severity }[]): ResultCategory {
  if (status === "partial") return "parcial";
  if (findings.some((f) => f.severity === "critical" || f.severity === "error")) return "critico";
  if (findings.some((f) => f.severity === "warning")) return "advertencias";
  return "sin-hallazgos";
}

export function formatNumber(n: number): string {
  return n.toLocaleString("es-ES");
}
