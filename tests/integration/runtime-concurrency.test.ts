/**
 * Integración de EngineRuntime centrada en las dos cosas que el motor puro
 * no puede modelar por sí solo: la ventana de concurrencia (dos solicitudes
 * para la misma clave antes de que la primera resuelva) y la cancelación de
 * una solicitud pendiente.
 *
 * Se usan temporizadores falsos para que la ventana de carrera sea
 * determinista: la segunda solicitud debe resolverse SIN avanzar el reloj,
 * porque el lock por clave se comprueba de forma síncrona en `submit`. Si
 * alguna de estas pruebas necesitara `advanceTimersByTime` para la segunda
 * solicitud, la guarda de concurrencia ya no estaría cerrando la ventana.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EngineRuntime } from "../../src/domain/runtime";
import { LIMITS } from "../../src/domain/limits";
import type { InputEnvelope } from "../../src/domain/types";

const SCENARIO_ID = "charge-card";
const KEY = "idem_charge_7f3e";

function envelope(payload: Record<string, unknown> = { orderId: "ord_1" }): InputEnvelope {
  return { schemaVersion: "1.0.0", scenarioId: SCENARIO_ID, payload, options: { deterministic: true } };
}

let runtime: EngineRuntime;

beforeEach(() => {
  vi.useFakeTimers();
  runtime = new EngineRuntime();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("EngineRuntime — ventana de concurrencia", () => {
  it("should resolve the second submit as a concurrent guard without advancing any timer", async () => {
    const first = runtime.submit(envelope());
    const second = runtime.submit(envelope());

    // Sin `advanceTimersByTime`: si esto se colgara, la guarda no sería
    // síncrona y el test fallaría por timeout en lugar de por aserción.
    const outputSecond = await second.promise;

    expect(outputSecond.status).toBe("partial");
    expect(outputSecond.findings.map((f) => f.ruleId)).toEqual(["IDEMP_CONCURRENT_GUARD"]);
    expect(first.requestId).not.toBe(second.requestId);
  });

  it("should let the first submit complete once the processing delay elapses", async () => {
    const first = runtime.submit(envelope());
    const second = runtime.submit(envelope());
    await second.promise;

    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const outputFirst = await first.promise;

    expect(outputFirst.status).toBe("completed");
    expect(runtime.getState().records[KEY]?.status).toBe("completed");
    expect(runtime.getState().records[KEY]?.storedOutput?.runId).toBe(outputFirst.runId);
  });

  it("should record the concurrent guard in the timeline before the first execution", async () => {
    const first = runtime.submit(envelope());
    const second = runtime.submit(envelope());
    await second.promise;
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    await first.promise;

    expect(runtime.getState().transitions.map((t) => t.kind)).toEqual([
      "concurrent-guard",
      "first-execution",
    ]);
  });

  it("should not leave the key stuck in-progress after the owning request finishes", async () => {
    const first = runtime.submit(envelope());
    const second = runtime.submit(envelope());
    await second.promise;
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const outputFirst = await first.promise;

    const third = runtime.submit(envelope());
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const outputThird = await third.promise;

    expect(outputThird.status).toBe("completed");
    expect(outputThird.runId).toBe(outputFirst.runId); // retry-hit sobre el resultado guardado
  });

  it("should never persist a result from the concurrent request itself", async () => {
    const first = runtime.submit(envelope());
    const second = runtime.submit(envelope());
    const outputSecond = await second.promise;
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    await first.promise;

    expect(runtime.getState().records[KEY]?.storedOutput?.runId).not.toBe(outputSecond.runId);
  });

  it("should resolve the owning request as a retry-hit (not a fresh first-execution) when the race happens against an already-completed key with an unchanged payload", async () => {
    // Regresión: ejecutar una vez hasta completar (registro `completed`
    // guardado), y solo DESPUÉS lanzar la carrera concurrente sobre esa misma
    // clave — a diferencia del resto de pruebas de este describe, que
    // siempre corren contra una clave virgen.
    const initial = runtime.submit(envelope());
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const initialOutput = await initial.promise;
    expect(initialOutput.status).toBe("completed");

    const owner = runtime.submit(envelope());
    const racer = runtime.submit(envelope());
    const racerOutput = await racer.promise;
    expect(racerOutput.status).toBe("partial"); // guarda de concurrencia, como siempre

    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const ownerOutput = await owner.promise;

    // El bug reportado convertía esto en un "first-execution" con un runId
    // nuevo, perdiendo el registro guardado originalmente.
    expect(ownerOutput.status).toBe("completed");
    expect(ownerOutput.runId).toBe(initialOutput.runId);
    expect(runtime.getState().transitions.map((t) => t.kind)).toEqual([
      "first-execution",
      "concurrent-guard",
      "retry-hit",
    ]);
    expect(runtime.getState().records[KEY]?.status).toBe("completed");
    expect(runtime.getState().records[KEY]?.storedOutput?.runId).toBe(initialOutput.runId);
  });

  it("should resolve the owning request as a conflict (not a fresh first-execution) when the race happens against an already-completed key with an edited payload", async () => {
    const initial = runtime.submit(envelope());
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const initialOutput = await initial.promise;
    expect(initialOutput.status).toBe("completed");

    const editedPayload = { orderId: "ord_1", extra: "edited-during-the-race" };
    const owner = runtime.submit(envelope(editedPayload));
    const racer = runtime.submit(envelope(editedPayload));
    await racer.promise;

    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const ownerOutput = await owner.promise;

    expect(ownerOutput.status).toBe("failed");
    expect(ownerOutput.findings.some((f) => f.ruleId === "IDEMP_KEY_CONFLICT")).toBe(true);
    // El registro guardado originalmente no se sobrescribe ni su runId cambia.
    expect(runtime.getState().records[KEY]?.status).toBe("completed");
    expect(runtime.getState().records[KEY]?.storedOutput?.runId).toBe(initialOutput.runId);
  });

  it("should allow a different key to proceed in parallel without a concurrent guard", async () => {
    const a = runtime.submit(envelope());
    const b = runtime.submit({ ...envelope(), scenarioId: "reserve-inventory" });

    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const [outputA, outputB] = await Promise.all([a.promise, b.promise]);

    expect(outputA.status).toBe("completed");
    expect(outputB.status).toBe("completed");
    expect(runtime.getState().transitions.map((t) => t.kind)).toEqual([
      "first-execution",
      "first-execution",
    ]);
  });
});

describe("EngineRuntime — cancelación", () => {
  it("should resolve a pending request as cancelled instead of rejecting it", async () => {
    const handle = runtime.submit(envelope());

    runtime.cancel(handle.requestId);
    const output = await handle.promise;

    expect(output.status).toBe("cancelled");
    expect(output.findings.map((f) => f.ruleId)).toEqual(["RUN_CANCELLED"]);
  });

  it("should clear the pending timer so the cancelled run never completes afterwards", async () => {
    const handle = runtime.submit(envelope());
    runtime.cancel(handle.requestId);
    await handle.promise;

    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS * 3);

    expect(vi.getTimerCount()).toBe(0);
    expect(runtime.getState().records[KEY]).toBeUndefined();
    expect(runtime.getState().transitions.map((t) => t.kind)).toEqual(["cancelled"]);
  });

  it("should release the key lock so a later submit is a first execution, not a concurrent guard", async () => {
    const cancelled = runtime.submit(envelope());
    runtime.cancel(cancelled.requestId);
    await cancelled.promise;

    const next = runtime.submit(envelope());
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const output = await next.promise;

    expect(output.status).toBe("completed");
    expect(runtime.getState().transitions.map((t) => t.kind)).toEqual(["cancelled", "first-execution"]);
  });

  it("should be a no-op when cancelling an id that already resolved", async () => {
    const handle = runtime.submit(envelope());
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    await handle.promise;
    const transitionsBefore = runtime.getState().transitions.length;

    expect(() => runtime.cancel(handle.requestId)).not.toThrow();
    expect(() => runtime.cancel(handle.requestId)).not.toThrow();

    expect(runtime.getState().transitions).toHaveLength(transitionsBefore);
  });

  it("should be a no-op for an unknown requestId", () => {
    expect(() => runtime.cancel("no-existe")).not.toThrow();
    expect(runtime.getState().transitions).toHaveLength(0);
  });

  it("should be a no-op when cancelling twice a request that was already cancelled", async () => {
    const handle = runtime.submit(envelope());

    runtime.cancel(handle.requestId);
    await handle.promise;
    runtime.cancel(handle.requestId);

    expect(runtime.getState().transitions.map((t) => t.kind)).toEqual(["cancelled"]);
  });
});

describe("EngineRuntime — borrado de datos con una solicitud en vuelo", () => {
  it("resetAll should not leave residue from a submit that was still processing when it was called", async () => {
    const handle = runtime.submit(envelope()); // no se espera: sigue "en vuelo"

    runtime.resetAll();

    // La solicitud huérfana se resuelve (no se queda colgada para siempre).
    const output = await handle.promise;
    expect(output.status).toBe("cancelled");

    // Avanzar el reloj real más allá del retardo simulado no debe recrear el
    // registro para esta clave: el temporizador se canceló de verdad.
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS * 3);
    expect(runtime.getState().records[KEY]).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);

    // Y la clave ya no queda marcada "en vuelo": el siguiente submit debe ser
    // una primera ejecución normal, no una guarda de concurrencia fantasma.
    const next = runtime.submit(envelope());
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const nextOutput = await next.promise;
    expect(nextOutput.status).toBe("completed");
  });

  it("resetScenario should not leave residue from a submit for that key that was still processing", async () => {
    const handle = runtime.submit(envelope());

    runtime.resetScenario(KEY);

    const output = await handle.promise;
    expect(output.status).toBe("cancelled");

    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS * 3);
    expect(runtime.getState().records[KEY]).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("EngineRuntime — reloj propio", () => {
  it("should expire a short-TTL key when advanceClock crosses its TTL", async () => {
    const reserve: InputEnvelope = {
      schemaVersion: "1.0.0",
      scenarioId: "reserve-inventory",
      payload: { skuId: "sku_lamp_01" },
      options: { deterministic: true },
    };
    const handle = runtime.submit(reserve);
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    await handle.promise;

    const state = runtime.advanceClock(LIMITS.SHORT_TTL_MS + 1000);

    expect(state.records["idem_reserve_9a1c"]?.status).toBe("expired");
  });

  it("should not couple the logical clock to the real timer used for the processing delay", async () => {
    const handle = runtime.submit(envelope());
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    await handle.promise;

    // El retardo simulado son 650 ms reales, pero el reloj lógico solo
    // avanza CLOCK_TICK_MS por operación resuelta.
    expect(runtime.getState().clockMs).toBe(LIMITS.CLOCK_TICK_MS);
  });
});
