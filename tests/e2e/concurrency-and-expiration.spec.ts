/**
 * Las dos decisiones que no se pueden provocar solo reintentando: la guarda
 * de concurrencia (dos solicitudes para la misma clave a la vez) y la
 * expiración de clave (cruzar el TTL con el control de reloj de la UI).
 */
import { expect, test } from "@playwright/test";
import {
  DECISION,
  SCENARIO_TABS,
  executeAndWait,
  readRunId,
  resultRegion,
  runCards,
  selectScenario,
  waitForRunsResolved,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("simular una petición concurrente produce una guarda de concurrencia parcial", async ({ page }) => {
  await page.getByRole("button", { name: "Simular petición concurrente" }).click();
  await waitForRunsResolved(page, 2);

  const concurrentCard = runCards(page).filter({ hasText: DECISION.concurrentGuard });
  await expect(concurrentCard).toHaveCount(1);
  await expect(concurrentCard).toContainText("Parcial");
  await expect(concurrentCard).toContainText("la primera solicitud sigue en curso");
  await expect(concurrentCard).toContainText("Confianza: media");

  // La solicitud propietaria del lock sí completa como primera ejecución.
  await expect(runCards(page).filter({ hasText: DECISION.firstExecution })).toHaveCount(1);
});

test("simular una petición concurrente sobre una clave ya completada resuelve como reintento, no como una primera ejecución nueva", async ({
  page,
}) => {
  // Regresión: ejecutar primero hasta completar (registro guardado), y solo
  // DESPUÉS disparar "Simular petición concurrente" sobre la misma clave sin
  // tocar el payload — la ruta que un visitante técnico probaría primero.
  await executeAndWait(page, 1);
  const originalRunId = await readRunId(runCards(page).first());

  await page.getByRole("button", { name: "Simular petición concurrente" }).click();
  await waitForRunsResolved(page, 3);

  // Se identifica cada tarjeta por su propio encabezado ("solicitud A" /
  // "solicitud B"), no por el texto de la decisión: la tarjeta propietaria
  // ahora comparte runId (y por tanto la sección "Decisiones" agrupada, que
  // lista TODAS las transiciones de ese runId) con la ejecución original, así
  // que ambas acaban conteniendo el texto "Reintento — mismo resultado" —
  // eso es justo la prueba de que es el MISMO runId, no un fallo del test.
  const ownerCard = runCards(page).filter({ has: page.getByRole("heading", { name: /solicitud A/ }) });
  await expect(ownerCard).toHaveCount(1);
  await expect(ownerCard).toContainText(DECISION.retryHit);
  expect(await readRunId(ownerCard)).toBe(originalRunId);

  const racerCard = runCards(page).filter({ has: page.getByRole("heading", { name: /solicitud B/ }) });
  await expect(racerCard).toHaveCount(1);
  await expect(racerCard).toContainText(DECISION.concurrentGuard);
  await expect(racerCard).toContainText("Parcial");
});

test("la guarda de concurrencia se explica como carrera simulada, no como concurrencia real", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Simular petición concurrente" }).click();
  await waitForRunsResolved(page, 2);

  await expect(runCards(page).filter({ hasText: DECISION.concurrentGuard })).toContainText(
    "una ventana de carrera simulada en un único hilo, no concurrencia real"
  );
});

test("cruzar el TTL expira la clave y la siguiente ejecución vuelve a ser una primera ejecución", async ({
  page,
}) => {
  await selectScenario(page, SCENARIO_TABS.reserveInventory);
  await executeAndWait(page, 1);
  const runIdBeforeExpiry = await readRunId(runCards(page).first());

  await page.getByRole("button", { name: /expira la clave/ }).click();

  await expect(resultRegion(page)).toContainText("Eventos del reloj");
  const expiryEvent = resultRegion(page).getByRole("group").filter({ hasText: DECISION.expiredKey });
  await expect(expiryEvent.first()).toBeVisible();
  await expect(expiryEvent.first()).toContainText("superó su TTL simulado");

  await executeAndWait(page, 2);

  const freshCard = runCards(page).first();
  await expect(freshCard).toContainText(DECISION.firstExecution);
  await expect(freshCard).toContainText("Completado");
  expect(await readRunId(freshCard)).not.toBe(runIdBeforeExpiry);
});

test("sin cruzar el TTL, el mismo escenario sigue devolviendo el resultado guardado", async ({
  page,
}) => {
  await selectScenario(page, SCENARIO_TABS.reserveInventory);
  await executeAndWait(page, 1);
  const originalRunId = await readRunId(runCards(page).first());

  await page.getByRole("button", { name: "+1 s" }).click();
  await executeAndWait(page, 2);

  await expect(runCards(page).first()).toContainText(DECISION.retryHit);
  expect(await readRunId(runCards(page).first())).toBe(originalRunId);
});

test("el escenario de TTL largo no ofrece el atajo de expiración y lo explica", async ({ page }) => {
  await expect(page.getByRole("button", { name: /expira la clave/ })).toHaveCount(0);
  await expect(page.getByText(/Usa «Reservar inventario» para demostrar expiración/)).toBeVisible();
});

test("«Eliminar datos locales» devuelve la demo a su estado inicial", async ({ page }) => {
  await executeAndWait(page, 1);

  await page.getByRole("button", { name: "Eliminar datos locales" }).click();

  await expect(page.getByText("0 ejecuciones registradas todavía.")).toBeVisible();
  await expect(runCards(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Exportar Markdown" })).toBeDisabled();
});
