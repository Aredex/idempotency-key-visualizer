/**
 * Utilidades compartidas por las pruebas de contrato.
 *
 * ajv SOLO puede vivir aquí (Node): compila los validadores con
 * `new Function(...)`, lo que exigiría `'unsafe-eval'` en la CSP del
 * navegador. El bundle usa el validador escrito a mano de
 * src/domain/envelope.ts; estas pruebas existen precisamente para detectar
 * que ambos no han divergido.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";

/** `process.cwd()` es la raíz del proyecto bajo vitest; `import.meta.url` no
 * sirve aquí porque el entorno jsdom lo reescribe a una URL http. */
function loadSchema(name: string): object {
  return JSON.parse(readFileSync(resolve(process.cwd(), "contracts", name), "utf8")) as object;
}

export const inputSchema = loadSchema("input.schema.json");
export const outputSchema = loadSchema("output.schema.json");

export function compile(schema: object): ValidateFunction {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  return ajv.compile(schema);
}
