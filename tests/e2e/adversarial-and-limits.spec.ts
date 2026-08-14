/**
 * Casos borde y adversariales (08-seguridad-privacidad.md · "Verificación"):
 * contenido hostil que debe renderizarse como texto inerte, entrada inválida
 * que nunca llega a despacharse, y el payload exactamente en el límite del
 * contrato que sí debe seguir siendo válido.
 */
import { expect, test } from "@playwright/test";
import {
  DECISION,
  SCENARIO_TABS,
  executeAndWait,
  executeButton,
  failOnDialog,
  payloadEditor,
  resultRegion,
  runCards,
  selectScenario,
  setPayload,
  workbenchRegion,
} from "./helpers";

const HOSTILE_IMG = "<img src=x onerror=alert(1)>";
const HOSTILE_SCRIPT = "</script><script>alert(1)</script>";

const EDITED_ADVERSARIAL = JSON.stringify(
  { note: HOSTILE_IMG, script: HOSTILE_SCRIPT, longField: "payload-editado-para-forzar-conflicto" },
  null,
  2
);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("el contenido adversarial se renderiza como texto literal y nunca se ejecuta", async ({ page }) => {
  const { assertNoDialog } = failOnDialog(page);

  await selectScenario(page, SCENARIO_TABS.adversarial);
  await expect(payloadEditor(page)).toHaveValue(new RegExp(escapeForRegExp(HOSTILE_IMG)));
  await executeAndWait(page, 1);

  // Forzamos un conflicto: es la vista que vuelca ambos payloads como texto
  // visible, así que es donde se puede comprobar que el HTML hostil aparece
  // literalmente en lugar de haberse interpretado.
  await setPayload(page, EDITED_ADVERSARIAL);
  await executeAndWait(page, 2);

  const conflictCard = runCards(page).first();
  await expect(conflictCard).toContainText(DECISION.conflict);
  await expect(conflictCard).toContainText(HOSTILE_IMG);
  await expect(conflictCard).toContainText(HOSTILE_SCRIPT);

  // Ni el HTML del payload se convirtió en nodos reales, ni se abrió ningún
  // diálogo nativo en ningún momento del test.
  await expect(resultRegion(page).locator("img")).toHaveCount(0);
  await expect(resultRegion(page).locator("script")).toHaveCount(0);
  assertNoDialog();
});

test("un valor de payload muy largo en el diff de conflicto no rompe el ancho de la página", async ({
  page,
}) => {
  // Regresión QA (hallazgo MEDIO #3): un único valor string de miles de
  // caracteres pasa todos los límites de forma (1 propiedad, profundidad 1)
  // pero, sin truncar en el render del diff, ensanchaba `scrollWidth` a
  // ~1.5M px. Se usa una longitud por debajo de MAX_PAYLOAD_STRING_CHARS
  // (10.000) para que la entrada siga siendo válida y llegue a renderizarse.
  // Importante: el valor tiene que quedar en `differing` (misma clave en
  // ambos payloads, valor distinto) — es la única rama del diff que invoca
  // `formatValue`; una clave nueva ("onlyInIncoming") solo muestra su
  // nombre, nunca el valor.
  const longValue = "A".repeat(1500);

  await selectScenario(page, SCENARIO_TABS.chargeCard);
  await executeAndWait(page, 1);

  await setPayload(
    page,
    JSON.stringify(
      { orderId: "ord_7f3e", amountCents: 4599, currency: "EUR", customerEmail: longValue },
      null,
      2
    )
  );
  await executeAndWait(page, 2);

  await expect(runCards(page).first()).toContainText(DECISION.conflict);

  const viewportWidth = page.viewportSize()?.width ?? 1280;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThan(viewportWidth * 2);
});

test("el payload adversarial no rompe el resto de la página", async ({ page }) => {
  const { assertNoDialog } = failOnDialog(page);

  await selectScenario(page, SCENARIO_TABS.adversarial);
  await executeAndWait(page, 1);

  await expect(runCards(page).first()).toContainText(DECISION.firstExecution);
  await expect(runCards(page).first()).toContainText("Completado");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  assertNoDialog();
});

test("la entrada inválida de demo muestra un error inline y nunca se despacha", async ({ page }) => {
  await page.getByRole("button", { name: "Cargar entrada inválida (demo)" }).click();

  const error = page.getByRole("alert");
  await expect(error).toBeVisible();
  await expect(error).toContainText("No pudimos procesar esta entrada. Tus datos no se enviaron");
  await expect(error).toContainText("El texto pegado no es JSON válido.");
  await expect(workbenchRegion(page)).toContainText("Inválida");

  await executeButton(page).click();

  // Nada llega al motor: no se crea ninguna ejecución, ni completada ni fallida.
  await expect(page.getByText("0 ejecuciones registradas todavía.")).toBeVisible();
  await expect(runCards(page)).toHaveCount(0);
  await expect(error).toBeFocused();
});

test("corregir la entrada inválida devuelve el CTA a un estado ejecutable", async ({ page }) => {
  await page.getByRole("button", { name: "Cargar entrada inválida (demo)" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await setPayload(page, JSON.stringify({ orderId: "ord_corregido" }, null, 2));

  await expect(page.getByRole("alert")).toHaveCount(0);
  await executeAndWait(page, 1);
  await expect(runCards(page).first()).toContainText("Completado");
});

test("el payload exactamente en el límite de 200 propiedades sigue siendo válido", async ({ page }) => {
  await selectScenario(page, SCENARIO_TABS.boundary);

  await expect(workbenchRegion(page)).toContainText("200 / 200 propiedades de nivel superior");
  await expect(page.getByRole("alert")).toHaveCount(0);

  await executeAndWait(page, 1);

  await expect(runCards(page).first()).toContainText("Completado");
  await expect(runCards(page).first()).toContainText(DECISION.firstExecution);
});

test("superar el límite de propiedades se rechaza con un hallazgo del motor, no en silencio", async ({
  page,
}) => {
  const payload: Record<string, number> = {};
  for (let i = 0; i <= 200; i += 1) payload[`prop_${i}`] = i;
  await setPayload(page, JSON.stringify(payload));

  await executeAndWait(page, 1);

  const card = runCards(page).first();
  await expect(card).toContainText("Fallido");
  await expect(card).toContainText("LIMIT_EXCEEDED");
  await expect(card).toContainText("máximo de 200 propiedades de nivel superior");
});

test("desactivar el modo determinista añade el hallazgo de fallback sin romper la ejecución", async ({
  page,
}) => {
  await page.getByLabel("Modo determinista (recomendado)").uncheck();

  await executeAndWait(page, 1);

  const card = runCards(page).first();
  await expect(card).toContainText("Completado");
  await expect(card).toContainText("Fallback de dependencia");
  await expect(card).toContainText("IDEMP_DEPENDENCY_FALLBACK");
  await expect(card).toContainText("el adaptador real está deshabilitado por diseño");
});

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
