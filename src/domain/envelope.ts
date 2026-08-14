import { LIMITS } from "./limits";
import type { InputEnvelope } from "./types";
import { EngineError } from "./types";

/**
 * Validador manual, escrito a mano, de contracts/input.schema.json.
 *
 * Decisión: no se usa ajv (ni ningún compilador de JSON Schema) en el bundle
 * del navegador. ajv genera el validador con `new Function(...)` en tiempo de
 * ejecución, lo que exige `'unsafe-eval'` en la CSP. Preferimos una CSP
 * `script-src 'self'` estricta a la comodidad de un compilador genérico, así
 * que este módulo reimplementa a mano — y solo para este contrato concreto —
 * las mismas reglas que describe el schema. Las pruebas de contrato
 * (tests/contract) sí usan ajv en Node para comprobar que este validador y el
 * schema JSON no han divergido.
 */
export function validateInputEnvelope(data: unknown): InputEnvelope {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new EngineError({
      code: "INPUT_INVALID",
      message: "La entrada debe ser un objeto JSON.",
      paths: ["$"],
    });
  }

  const obj = data as Record<string, unknown>;

  // El tope de propiedades del payload se comprueba primero y por separado:
  // produce un LIMIT_EXCEEDED más específico que el INPUT_INVALID genérico
  // que emitiría el resto de esta función si tratara el payload como "forma
  // inválida" sin más.
  if (typeof obj.payload === "object" && obj.payload !== null && !Array.isArray(obj.payload)) {
    const payload = obj.payload as Record<string, unknown>;
    if (Object.keys(payload).length > LIMITS.MAX_PAYLOAD_PROPERTIES) {
      throw new EngineError({
        code: "LIMIT_EXCEEDED",
        message: `El payload supera el máximo de ${LIMITS.MAX_PAYLOAD_PROPERTIES} propiedades de nivel superior.`,
        paths: ["$.payload"],
      });
    }
    const walk = walkPayload(payload);
    if (walk.exceededString) {
      throw new EngineError({
        code: "LIMIT_EXCEEDED",
        message: `El payload contiene un valor de texto más largo que el máximo permitido (${LIMITS.MAX_PAYLOAD_STRING_CHARS} caracteres).`,
        paths: ["$.payload"],
      });
    }
    if (walk.exceeded) {
      throw new EngineError({
        code: "LIMIT_EXCEEDED",
        message: `El payload supera el límite de profundidad (${LIMITS.MAX_PAYLOAD_DEPTH}) o de nodos (${LIMITS.MAX_PAYLOAD_NODES}) permitido.`,
        paths: ["$.payload"],
      });
    }
  }

  const paths: string[] = [];

  const allowedKeys = new Set(["schemaVersion", "scenarioId", "payload", "options"]);
  for (const key of Object.keys(obj)) {
    if (!allowedKeys.has(key)) paths.push(`$.${key}`);
  }

  if (obj.schemaVersion !== "1.0.0") paths.push("$.schemaVersion");

  if (
    typeof obj.scenarioId !== "string" ||
    obj.scenarioId.length < 1 ||
    obj.scenarioId.length > LIMITS.MAX_SCENARIO_ID_LENGTH ||
    !/^[a-z0-9-]+$/.test(obj.scenarioId)
  ) {
    paths.push("$.scenarioId");
  }

  if (typeof obj.payload !== "object" || obj.payload === null || Array.isArray(obj.payload)) {
    paths.push("$.payload");
  }

  if (typeof obj.options !== "object" || obj.options === null || Array.isArray(obj.options)) {
    paths.push("$.options");
  } else {
    const options = obj.options as Record<string, unknown>;
    const allowedOptionKeys = new Set(["deterministic"]);
    for (const key of Object.keys(options)) {
      if (!allowedOptionKeys.has(key)) paths.push(`$.options.${key}`);
    }
    if (typeof options.deterministic !== "boolean") paths.push("$.options.deterministic");
  }

  if (paths.length > 0) {
    throw new EngineError({
      code: "INPUT_INVALID",
      message: "La entrada no cumple el contrato de entrada (contracts/input.schema.json).",
      paths,
    });
  }

  return obj as unknown as InputEnvelope;
}

/**
 * Recorrido acotado del payload: se detiene en cuanto se alcanza el límite
 * de profundidad o de nodos visitados (lo que ocurra primero), para que un
 * payload hostil (muy anidado o con muchísimos nodos) no pueda colgar la
 * validación — es el límite de "profundidad/tamaño/cantidad/tiempo" exigido
 * por 08-seguridad-privacidad.md.
 */
function walkPayload(payload: Record<string, unknown>): { exceeded: boolean; exceededString: boolean } {
  let nodes = 0;
  let exceeded = false;
  let exceededString = false;

  function visit(value: unknown, depth: number): void {
    if (exceeded || exceededString) return;
    nodes += 1;
    if (depth > LIMITS.MAX_PAYLOAD_DEPTH || nodes > LIMITS.MAX_PAYLOAD_NODES) {
      exceeded = true;
      return;
    }
    if (typeof value === "string" && value.length > LIMITS.MAX_PAYLOAD_STRING_CHARS) {
      exceededString = true;
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item, depth + 1);
        if (exceeded || exceededString) return;
      }
      return;
    }
    if (typeof value === "object" && value !== null) {
      for (const key of Object.keys(value as Record<string, unknown>)) {
        visit((value as Record<string, unknown>)[key], depth + 1);
        if (exceeded || exceededString) return;
      }
    }
  }

  visit(payload, 0);
  return { exceeded, exceededString };
}

/** Parseo de texto a JSON con límites de tamaño, sin `eval`/`Function`. */
export function parsePayloadText(text: string): unknown {
  if (text.length > LIMITS.MAX_INPUT_TEXT_CHARS) {
    throw new EngineError({
      code: "LIMIT_EXCEEDED",
      message: `El texto pegado supera ${LIMITS.MAX_INPUT_TEXT_CHARS.toLocaleString("es-ES")} caracteres.`,
      paths: ["$"],
    });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new EngineError({
      code: "INPUT_INVALID",
      message: "El texto pegado no es JSON válido.",
      paths: ["$"],
    });
  }
}
