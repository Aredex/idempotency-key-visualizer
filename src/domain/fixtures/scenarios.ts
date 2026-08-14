/**
 * Escenarios precargados que la UI ofrece como punto de partida. Cada uno
 * fija una clave de idempotencia y un TTL pensados para poder demostrar un
 * comportamiento concreto (primera ejecución, límite de tamaño, contenido
 * adversarial, expiración rápida) sin que el visitante tenga que inventar un
 * payload desde cero.
 */
import { LIMITS } from "../limits";
import type { ScenarioFixture } from "../types";

function buildBoundaryPayload(): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (let i = 0; i < 200; i += 1) {
    payload[`prop_${i}`] = i % 2 === 0 ? i : `value_${i}`;
  }
  return payload;
}

export const SCENARIOS: ScenarioFixture[] = [
  {
    id: "charge-card",
    title: "Cobro con tarjeta",
    description:
      "El caso clásico de idempotencia: reintentar un cobro tras un timeout no debe cobrar dos veces.",
    idempotencyKey: "idem_charge_7f3e",
    ttlMs: LIMITS.DEFAULT_TTL_MS,
    initialPayload: {
      orderId: "ord_7f3e",
      amountCents: 4599,
      currency: "EUR",
      customerEmail: "demo@example.com",
    },
    tags: ["preset"],
  },
  {
    id: "reserve-inventory",
    title: "Reservar inventario",
    description:
      "TTL deliberadamente corto para poder demostrar la expiración de la clave avanzando el reloj apenas unos segundos.",
    idempotencyKey: "idem_reserve_9a1c",
    ttlMs: LIMITS.SHORT_TTL_MS,
    initialPayload: {
      skuId: "sku_lamp_01",
      quantity: 2,
      warehouse: "MAD1",
    },
    tags: ["preset"],
  },
  {
    id: "boundary-payload",
    title: "Caso límite: 200 propiedades",
    description:
      "Payload construido exactamente en el límite de propiedades del contrato de entrada (maxProperties: 200): debe seguir siendo válido.",
    idempotencyKey: "idem_boundary_case",
    ttlMs: LIMITS.DEFAULT_TTL_MS,
    initialPayload: buildBoundaryPayload(),
    tags: ["boundary"],
  },
  {
    id: "adversarial-content",
    title: "Caso adversarial",
    description:
      "Contenido pensado para probar que el motor nunca interpreta ni ejecuta el payload (solo lo huella y lo guarda como texto).",
    idempotencyKey: "idem_adversarial",
    ttlMs: LIMITS.DEFAULT_TTL_MS,
    initialPayload: {
      note: "<img src=x onerror=alert(1)>",
      script: "</script><script>alert(1)</script>",
      longField: "a".repeat(5000),
    },
    tags: ["adversarial"],
  },
  {
    id: "webhook-delivery",
    title: "Entrega de webhook",
    description:
      "Un proveedor externo reintenta la entrega de un webhook con la misma clave de idempotencia tras no recibir un 2xx a tiempo.",
    idempotencyKey: "idem_webhook_5d2b",
    ttlMs: LIMITS.DEFAULT_TTL_MS,
    initialPayload: {
      eventId: "evt_5d2b",
      eventType: "payment.succeeded",
      deliveryAttempt: 1,
    },
    tags: ["preset"],
  },
];

/** JSON deliberadamente malformado (clave sin comillas) — preset de un
 * clic para demostrar el camino INPUT_INVALID de parsePayloadText. */
export const INVALID_INPUT_DEMO_TEXT = '{ "orderId": "ord_broken", amountCents: 999 }';

export const DEFAULT_SCENARIO_ID = "charge-card";

export function getScenario(id: string): ScenarioFixture | undefined {
  return SCENARIOS.find((scenario) => scenario.id === id);
}
