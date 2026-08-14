/**
 * Recorrido extendido de 90 s: editar el payload bajo la misma clave, ver el
 * conflicto con su diff accesible, abrir el detalle de una decisión y
 * exportar el reporte en Markdown.
 *
 * Sustituto automatizado de las pruebas de usabilidad observadas, no un
 * reemplazo de ellas.
 */
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { DECISION, executeAndWait, readRunId, resultRegion, runCards, setPayload } from "./helpers";

const CHARGE_KEY = "idem_charge_7f3e";

const EDITED_PAYLOAD = JSON.stringify(
  { orderId: "ord_7f3e", amountCents: 9999, currency: "EUR", customerEmail: "demo@example.com" },
  null,
  2
);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("editar el payload bajo la misma clave produce un conflicto que no sobrescribe lo guardado", async ({
  page,
}) => {
  await executeAndWait(page, 1);
  const originalRunId = await readRunId(runCards(page).first());

  await setPayload(page, EDITED_PAYLOAD);
  await executeAndWait(page, 2);

  const conflictCard = runCards(page).first();
  await expect(conflictCard).toContainText("Fallido");
  await expect(conflictCard).toContainText(DECISION.conflict);
  await expect(conflictCard).toContainText("El resultado guardado no se sobrescribe.");
  expect(await readRunId(conflictCard)).not.toBe(originalRunId);
});

test("el conflicto muestra un diff estructural legible sin depender del color", async ({ page }) => {
  await executeAndWait(page, 1);
  await setPayload(page, EDITED_PAYLOAD);
  await executeAndWait(page, 2);

  const conflictCard = runCards(page).first();
  await expect(conflictCard).toContainText("Comparación del payload");
  await expect(conflictCard).toContainText("Diferencia estructural (solo claves de nivel superior)");
  const diffEntry = conflictCard.getByRole("listitem").filter({ hasText: "(valor distinto)" });
  await expect(diffEntry).toHaveCount(1);
  await expect(diffEntry).toContainText("amountCents");
  await expect(diffEntry).toContainText("4599 → 9999");
  await expect(conflictCard).toContainText("Guardado originalmente");
  await expect(conflictCard).toContainText("Enviado ahora");
});

test("el detalle de una decisión se puede plegar y desplegar con el teclado", async ({ page }) => {
  await executeAndWait(page, 1);

  const decision = runCards(page).first().getByRole("group").first();
  const summary = decision.getByText(DECISION.firstExecution, { exact: true });
  const explanation = decision.getByText("No había ningún registro para esta clave de idempotencia:", {
    exact: false,
  });

  await expect(explanation).toBeVisible();

  await summary.click();
  await expect(explanation).toBeHidden();

  await summary.click();
  await expect(explanation).toBeVisible();
  await expect(decision).toContainText("Supuestos");
  await expect(decision).toContainText("Confianza: alta");
});

test("exportar el reporte en Markdown descarga un archivo con las secciones esperadas", async ({
  page,
}) => {
  await executeAndWait(page, 1);
  await setPayload(page, EDITED_PAYLOAD);
  await executeAndWait(page, 2);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar Markdown" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(`idempotency-report-${CHARGE_KEY}.md`);

  const path = await download.path();
  const content = readFileSync(path, "utf8");
  expect(content).toContain(`# Reporte de idempotencia — ${CHARGE_KEY}`);
  expect(content).toContain("## Resumen");
  expect(content).toContain("## Hallazgos");
  expect(content).toContain("## Transiciones");
  expect(content).toContain("## Supuestos");
  expect(content).toContain("IDEMP_FIRST_EXECUTION");
  // Sin marcar "incluir payload", ningún valor del payload viaja al reporte.
  expect(content).not.toContain("demo@example.com");
  expect(content).not.toContain("## Payload");
});

test("el reporte exportado con payload incluido llega redactado", async ({ page }) => {
  await executeAndWait(page, 1);

  await page.getByLabel("Incluir payload de ejemplo (redactado)").check();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar Markdown" }).click();
  const download = await downloadPromise;

  const content = readFileSync(await download.path(), "utf8");
  expect(content).toContain("## Payload (redactado)");
  expect(content).toContain("«redactado»");
  expect(content).not.toContain("demo@example.com");
});

test("no se puede exportar antes de ejecutar nada", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Exportar Markdown" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Exportar JSON" })).toBeDisabled();
  await expect(resultRegion(page)).toContainText(
    "Ejecuta el escenario para poder exportar un reporte de esta clave."
  );
});
