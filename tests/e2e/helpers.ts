/**
 * Localizadores compartidos por las pruebas E2E.
 *
 * Se basan en rol + nombre accesible o en texto visible (nunca en test-ids):
 * si un cambio de UI rompe uno de estos localizadores es porque ha cambiado
 * lo que una persona —o un lector de pantalla— percibe, que es justo lo que
 * estas pruebas deben proteger.
 */
import { expect, type Locator, type Page } from "@playwright/test";

export const SCENARIO_TABS = {
  chargeCard: "Cobro con tarjeta",
  reserveInventory: "Reservar inventario",
  boundary: "Caso límite: 200 propiedades",
  adversarial: "Caso adversarial",
  webhook: "Entrega de webhook",
} as const;

/** Etiquetas de decisión que la UI muestra (src/ui/labels.ts). */
export const DECISION = {
  firstExecution: "Primera ejecución",
  retryHit: "Reintento — mismo resultado",
  conflict: "Conflicto de clave",
  concurrentGuard: "Guarda de concurrencia",
  expiredKey: "Clave expirada",
} as const;

const SETTLE_TIMEOUT_MS = 20_000;

export function payloadEditor(page: Page): Locator {
  return page.getByLabel("Payload (JSON)");
}

/** El CTA real del banco de pruebas. El Hero tiene un enlace con el mismo
 * texto, así que el rol "button" es lo que los distingue. */
export function executeButton(page: Page): Locator {
  return page.getByRole("button", { name: "Ejecutar escenario" });
}

export function resultRegion(page: Page): Locator {
  return page.getByRole("region", { name: "Resultado" });
}

export function workbenchRegion(page: Page): Locator {
  return page.getByRole("region", { name: "Banco de pruebas" });
}

/** Tarjetas de ejecución del panel de resultado, la más reciente primero. */
export function runCards(page: Page): Locator {
  return resultRegion(page).getByRole("article");
}

export async function selectScenario(page: Page, title: string): Promise<void> {
  await page.getByRole("tab", { name: new RegExp(escapeRegExp(title)) }).click();
}

/**
 * Espera a que el panel de resultado declare que todas las ejecuciones
 * registradas están resueltas. El propio índice del panel ("N de M
 * ejecuciones recientes resueltas.") es el testigo: es texto que un
 * visitante ve, no un detalle interno.
 */
export async function waitForRunsResolved(page: Page, total: number): Promise<void> {
  await expect(
    page.getByText(`${total} de ${total} ejecuciones recientes resueltas.`)
  ).toBeVisible({ timeout: SETTLE_TIMEOUT_MS });
}

/** Lanza el escenario y espera a que las `totalRuns` ejecuciones acumuladas
 * en el panel estén resueltas. */
export async function executeAndWait(page: Page, totalRuns: number): Promise<void> {
  await executeButton(page).click();
  await waitForRunsResolved(page, totalRuns);
}

/** Lee el runId que la tarjeta de ejecución muestra en su línea de meta. */
export async function readRunId(card: Locator): Promise<string> {
  const meta = await card.getByText(/^runId:/).innerText();
  const match = /runId:\s*(\S+)/.exec(meta);
  if (!match?.[1]) throw new Error(`No se pudo leer el runId de la tarjeta: "${meta}"`);
  return match[1];
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Reemplaza por completo el contenido del editor de payload. */
export async function setPayload(page: Page, json: string): Promise<void> {
  await payloadEditor(page).fill(json);
}

/** Arma un detector que falla el test si la página abre cualquier diálogo
 * nativo (alert/confirm/prompt): la prueba de que el payload adversarial
 * nunca se ejecuta. */
export function failOnDialog(page: Page): { assertNoDialog: () => void } {
  const opened: string[] = [];
  page.on("dialog", (dialog) => {
    opened.push(`${dialog.type()}: ${dialog.message()}`);
    void dialog.dismiss();
  });
  return {
    assertNoDialog: () => {
      expect(opened, "La página abrió un diálogo nativo: el payload se ejecutó.").toEqual([]);
    },
  };
}
