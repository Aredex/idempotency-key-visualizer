/**
 * Huella (fingerprint) determinista de un payload, y utilidades relacionadas.
 */

/**
 * Serialización JSON determinista: las claves de cada objeto se ordenan
 * recursivamente para que el orden de escritura nunca cambie la huella
 * resultante (los arrays sí conservan su orden, que es significativo).
 * `undefined` en un objeto se omite, igual que hace JSON.stringify.
 *
 * Esto es lo que hace que "misma clave + mismo payload en distinto orden de
 * propiedades" cuente correctamente como un retry-hit y no como un conflicto
 * — ver la regla IDEMP_RETRY_HIT en rules.ts y el aviso correspondiente en la
 * copy de "Cómo funciona" del frontend.
 */
export function canonicalStringify(value: unknown): string {
  return stringify(value);
}

function stringify(value: unknown): string {
  if (value === undefined) return "null"; // solo relevante en la raíz; dentro de objetos se omite antes
  if (value === null) return "null";
  const t = typeof value;
  if (t === "number" || t === "boolean") return JSON.stringify(value);
  if (t === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : stringify(item))).join(",")}]`;
  }
  if (t === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((key) => obj[key] !== undefined)
      .sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stringify(obj[key])}`);
    return `{${entries.join(",")}}`;
  }
  // funciones, symbols, etc. no deberían aparecer en un payload JSON válido.
  return "null";
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Huella SHA-256 (primeros 16 caracteres hex) de la forma canónica del
 * payload. Es lo único que el motor compara para decidir retry-hit vs
 * conflict: nunca compara el payload textual ni lo guarda dos veces.
 */
export async function fingerprint(payload: unknown): Promise<string> {
  const json = canonicalStringify(payload);
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(digest).slice(0, 16);
}

/** Genera un runId estable y legible sin depender de un UUID externo. */
export function generateRunId(scenarioId: string): string {
  const random = crypto.getRandomValues(new Uint32Array(2));
  const suffix = Array.from(random)
    .map((n) => n.toString(36))
    .join("");
  return `run_${scenarioId}_${suffix}`.slice(0, 100);
}
