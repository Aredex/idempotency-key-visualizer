/**
 * Recorrido público de 30 s (03-ux-flujos-y-contenido.md): cargar, ejecutar
 * el escenario por defecto, entender la decisión y reintentar sin cambios
 * para ver que se devuelve EL MISMO resultado.
 *
 * Sustituto automatizado de las pruebas de usabilidad observadas, no un
 * reemplazo de ellas.
 */
import { expect, test } from "@playwright/test";
import {
  DECISION,
  executeAndWait,
  executeButton,
  payloadEditor,
  readRunId,
  runCards,
  waitForRunsResolved,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("carga mostrando el payload del escenario por defecto y su CTA", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Haz visible lo que normalmente falla en silencio."
  );
  await expect(payloadEditor(page)).toHaveValue(/"orderId": "ord_7f3e"/);
  await expect(payloadEditor(page)).toHaveValue(/"amountCents": 4599/);
  await expect(executeButton(page)).toBeEnabled();
  await expect(page.getByText("0 ejecuciones registradas todavía.")).toBeVisible();
});

test("la primera ejecución se completa y explica la decisión en lenguaje llano", async ({ page }) => {
  await executeAndWait(page, 1);

  const card = runCards(page).first();
  await expect(card).toContainText("Completado");
  await expect(card).toContainText(DECISION.firstExecution);
  await expect(card).toContainText("No había ningún registro para esta clave de idempotencia");
  await expect(card).toContainText("Confianza: alta");
  await expect(card).toContainText("Supuestos");
});

test("reintentar sin cambios devuelve el MISMO identificador de ejecución", async ({ page }) => {
  await executeAndWait(page, 1);
  const firstRunId = await readRunId(runCards(page).first());

  await executeAndWait(page, 2);

  const retryCard = runCards(page).first();
  await expect(retryCard).toContainText(DECISION.retryHit);
  await expect(retryCard).toContainText("Completado");
  expect(await readRunId(retryCard)).toBe(firstRunId);
});

test("el reintento lleva el aviso de idempotencia observada vs. exactly-once", async ({ page }) => {
  await executeAndWait(page, 1);
  await executeAndWait(page, 2);

  await expect(runCards(page).first()).toContainText(
    "no una garantía de exactly-once en un sistema distribuido real"
  );
});

test("el CTA se bloquea mientras la ejecución está en curso", async ({ page }) => {
  await executeButton(page).click();

  await expect(executeButton(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();

  await expect(executeButton(page)).toBeEnabled({ timeout: 20_000 });
});

test("el botón Cancelar detiene la ejecución en curso y no guarda ningún resultado", async ({ page }) => {
  await executeButton(page).click();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await waitForRunsResolved(page, 1);
  const card = runCards(page).first();
  await expect(card).toContainText("Cancelado");
  await expect(card).toContainText("Ejecución cancelada por el visitante antes de completarse.");

  // Nada se persistió: la clave sigue sin registro, así que no hay nada que exportar.
  await expect(page.getByRole("button", { name: "Exportar Markdown" })).toBeDisabled();
});

test("la nota de privacidad está visible sin tener que ejecutar nada", async ({ page }) => {
  await expect(page.getByText("El modo local no los envía a ningún servidor").first()).toBeVisible();
});
