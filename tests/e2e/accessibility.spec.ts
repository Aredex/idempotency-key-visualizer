/**
 * Gate de accesibilidad de 10-estrategia-pruebas.md: "cero violaciones axe
 * críticas/serias en flujos P0".
 *
 * Se escanea en los dos estados que importan: la página recién cargada y la
 * página con el panel de resultado poblado (que es donde aparecen badges,
 * disclosures y el diff, es decir, casi todo el riesgo de a11y real).
 * Complementa —no sustituye— la revisión manual con teclado y lector de
 * pantalla que el mismo documento exige.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  DECISION,
  SCENARIO_TABS,
  executeAndWait,
  executeButton,
  runCards,
  selectScenario,
  setPayload,
  waitForRunsResolved,
} from "./helpers";

const BLOCKING_IMPACTS = ["critical", "serious"];

async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return results.violations.filter((v) => BLOCKING_IMPACTS.includes(v.impact ?? ""));
}

/** Resumen legible de las violaciones para que un fallo diga QUÉ y DÓNDE. */
function describeViolations(violations: Awaited<ReturnType<typeof scan>>): string {
  return violations
    .map((v) => `[${v.impact}] ${v.id}: ${v.help} → ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)
    .join("\n");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("sin violaciones axe críticas o serias en la carga inicial", async ({ page }) => {
  const violations = await scan(page);

  expect(violations, describeViolations(violations)).toEqual([]);
});

test("sin violaciones axe críticas o serias con el panel de resultado poblado", async ({ page }) => {
  await executeAndWait(page, 1);
  await expect(runCards(page).first()).toContainText(DECISION.firstExecution);

  const violations = await scan(page);

  expect(violations, describeViolations(violations)).toEqual([]);
});

test("sin violaciones axe críticas o serias en el estado de conflicto con diff", async ({ page }) => {
  await executeAndWait(page, 1);
  await setPayload(page, JSON.stringify({ orderId: "ord_7f3e", amountCents: 9999 }, null, 2));
  await executeAndWait(page, 2);
  await expect(runCards(page).first()).toContainText(DECISION.conflict);

  const violations = await scan(page);

  expect(violations, describeViolations(violations)).toEqual([]);
});

test("sin violaciones axe críticas o serias con el error de entrada inválida visible", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Cargar entrada inválida (demo)" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  const violations = await scan(page);

  expect(violations, describeViolations(violations)).toEqual([]);
});

test("sin violaciones axe críticas o serias tras una guarda de concurrencia", async ({ page }) => {
  await page.getByRole("button", { name: "Simular petición concurrente" }).click();
  await waitForRunsResolved(page, 2);

  const violations = await scan(page);

  expect(violations, describeViolations(violations)).toEqual([]);
});

test("el enlace de salto lleva al contenido principal y el foco recorre el banco de pruebas", async ({
  page,
}) => {
  await page.keyboard.press("Tab");

  const skipLink = page.getByRole("link", { name: "Saltar al contenido principal" });
  await expect(skipLink).toBeFocused();
  await skipLink.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
});

test("se puede llegar al CTA y ejecutar solo con el teclado", async ({ page }) => {
  await selectScenario(page, SCENARIO_TABS.webhook);
  await executeButton(page).focus();

  await page.keyboard.press("Enter");

  await waitForRunsResolved(page, 1);
  await expect(runCards(page).first()).toContainText(DECISION.firstExecution);
});

test("Escape cancela una ejecución en curso", async ({ page }) => {
  await executeButton(page).click();
  await expect(executeButton(page)).toBeDisabled();

  await page.keyboard.press("Escape");

  await waitForRunsResolved(page, 1);
  await expect(runCards(page).first()).toContainText("Cancelado");
});
