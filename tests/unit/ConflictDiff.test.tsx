/**
 * Regresión de layout (QA · hallazgo MEDIO #3): un único valor string
 * desmesurado en el payload pasa todos los límites de tamaño/profundidad/
 * cantidad (1 propiedad, profundidad 1) pero, sin truncar en el render,
 * produce un nodo de texto de decenas de miles de caracteres dentro de un
 * `<li>` del diff de conflicto — capaz de reventar el ancho de la página.
 *
 * `formatValue` (src/ui/ConflictDiff.tsx) debe truncar cualquier valor
 * mostrado; el valor completo debe seguir disponible sin truncar en los
 * paneles "Guardado originalmente"/"Enviado ahora" (usados también por la
 * exportación), que sí muestran el JSON íntegro dentro de un contenedor con
 * scroll propio.
 */
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ConflictDiff } from "../../src/ui/ConflictDiff";

describe("ConflictDiff — truncamiento de valores largos en el render", () => {
  it("should truncate a very long string value inside the diff list instead of rendering it in full", () => {
    const longValue = "A".repeat(1500); // por debajo de MAX_PAYLOAD_STRING_CHARS, así que es una entrada válida

    render(
      <ConflictDiff
        storedPayload={{ nota: "corto" }}
        submittedPayload={{ nota: longValue }}
      />
    );

    const listItem = document.querySelector(".conflict-diff-list li");
    expect(listItem).not.toBeNull();

    const text = listItem!.textContent ?? "";
    // El valor íntegro (1500 caracteres) nunca debe aparecer completo en el DOM.
    expect(text).not.toContain(longValue);
    // La línea del diff, en su conjunto (clave + separadores + valor
    // truncado + etiqueta), se mantiene corta.
    expect(text.length).toBeLessThan(400);
    expect(text).toContain("…");
  });

  it("should still expose the untruncated value in the full-payload panels below the diff list", () => {
    const longValue = "B".repeat(1500);

    render(
      <ConflictDiff
        storedPayload={{ nota: "corto" }}
        submittedPayload={{ nota: longValue }}
      />
    );

    // Los paneles "Guardado originalmente"/"Enviado ahora" vuelcan el JSON
    // completo (con scroll propio vía CSS, no truncamiento): el dato real
    // sigue disponible para quien lo necesite exacto (p. ej. exportación).
    // Se busca solo dentro de los paneles (no del `<li>` del diff de arriba,
    // que si no truncara también contendría el valor íntegro).
    const panels = document.querySelector(".conflict-diff-panels");
    expect(panels).not.toBeNull();
    expect(panels!.textContent).toContain(longValue);
  });

  it("should not truncate short values", () => {
    render(
      <ConflictDiff
        storedPayload={{ amountCents: 100 }}
        submittedPayload={{ amountCents: 999 }}
      />
    );

    const listItem = document.querySelector(".conflict-diff-list li");
    expect(listItem?.textContent).toContain("100");
    expect(listItem?.textContent).toContain("999");
    expect(listItem?.textContent).not.toContain("…");
  });
});
