/**
 * Integración de src/worker/workerClient.ts.
 *
 * Bajo jsdom NO existe `Worker`, así que instanciar `WorkerClient` ejercita
 * exactamente el camino de resiliencia del runbook (11-despliegue-operacion.md):
 * "si falla Worker, servir modo determinista en el hilo principal". La
 * afirmación de que estamos en ese modo se comprueba explícitamente (primer
 * test) para que el resto de la suite no pueda volverse vacuo si algún día el
 * entorno de pruebas empieza a ofrecer Worker.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerClient } from "../../src/worker/workerClient";
import { LIMITS } from "../../src/domain/limits";
import type { EngineState, InputEnvelope, OutputEnvelope } from "../../src/domain/types";

const SCENARIO_ID = "charge-card";
const KEY = "idem_charge_7f3e"; // idempotencyKey del fixture charge-card

function envelope(payload: Record<string, unknown> = { orderId: "ord_1", amountCents: 4599 }): InputEnvelope {
  return { schemaVersion: "1.0.0", scenarioId: SCENARIO_ID, payload, options: { deterministic: true } };
}

/** Lanza `submit` y avanza los temporizadores falsos lo justo para que el
 * retardo de procesamiento simulado venza, resolviendo la promesa. */
async function submitAndSettle(client: WorkerClient, input: InputEnvelope): Promise<OutputEnvelope> {
  const { promise } = client.submit(input);
  await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
  const output = await promise;
  // Un tick extra de microtareas: el `finally` que reemite el estado se
  // encola al resolverse la promesa, después de que `await promise` continúe.
  await vi.advanceTimersByTimeAsync(0);
  return output;
}

let client: WorkerClient;

beforeEach(() => {
  vi.useFakeTimers();
  client = new WorkerClient();
});

afterEach(() => {
  client.terminate();
  vi.useRealTimers();
});

describe("WorkerClient — fallback en el hilo principal", () => {
  it("should be running without a real Worker in this environment", () => {
    expect(typeof Worker).toBe("undefined");
    expect(client.getState()).toEqual({ clockMs: 0, records: {}, transitions: [], runCounter: 0 });
  });

  it("should complete a first execution end to end", async () => {
    const output = await submitAndSettle(client, envelope());

    expect(output.status).toBe("completed");
    expect(client.getState().records[KEY]?.status).toBe("completed");
    expect(client.getState().transitions.map((t) => t.kind)).toEqual(["first-execution"]);
  });

  it("should return the same runId on an unchanged resubmit (retry-hit)", async () => {
    const first = await submitAndSettle(client, envelope());

    const second = await submitAndSettle(client, envelope());

    expect(second.status).toBe("completed");
    expect(second.runId).toBe(first.runId);
    expect(client.getState().transitions.map((t) => t.kind)).toEqual(["first-execution", "retry-hit"]);
  });

  it("should treat a reordered but equivalent payload as a retry, not as a conflict", async () => {
    const first = await submitAndSettle(client, envelope({ orderId: "ord_1", amountCents: 4599 }));

    const second = await submitAndSettle(client, envelope({ amountCents: 4599, orderId: "ord_1" }));

    expect(second.runId).toBe(first.runId);
  });

  it("should fail with a conflict when the payload was edited under the same key", async () => {
    const first = await submitAndSettle(client, envelope());

    const second = await submitAndSettle(client, envelope({ orderId: "ord_1", amountCents: 9999 }));

    expect(second.status).toBe("failed");
    expect(second.runId).not.toBe(first.runId);
    expect(second.findings.some((f) => f.ruleId === "IDEMP_KEY_CONFLICT")).toBe(true);
    expect(client.getState().records[KEY]?.storedOutput?.runId).toBe(first.runId);
  });

  it("should surface an invalid envelope as a failed run without waiting for the processing delay", async () => {
    const invalid = { ...envelope(), scenarioId: "NO VALIDO" } as InputEnvelope;

    const { promise } = client.submit(invalid);
    await vi.advanceTimersByTimeAsync(0);
    const output = await promise;

    expect(output.status).toBe("failed");
    expect(output.findings[0]?.ruleId).toBe("INPUT_INVALID");
  });
});

describe("WorkerClient — suscripción de estado", () => {
  it("should notify subscribers on every mutation", async () => {
    const seen: EngineState[] = [];
    client.onState((state) => seen.push(state));

    await submitAndSettle(client, envelope());
    client.advanceClock(1000);
    client.resetScenario(KEY);
    client.resetAll();

    expect(seen.length).toBeGreaterThanOrEqual(4);
    expect(seen[seen.length - 1]).toEqual({ clockMs: 0, records: {}, transitions: [], runCounter: 0 });
  });

  it("should deliver a state snapshot that matches getState()", async () => {
    let latest: EngineState | undefined;
    client.onState((state) => {
      latest = state;
    });

    await submitAndSettle(client, envelope());

    expect(latest).toBe(client.getState());
  });

  it("should stop notifying after the returned unsubscribe function is called", async () => {
    let calls = 0;
    const unsubscribe = client.onState(() => {
      calls += 1;
    });

    await submitAndSettle(client, envelope());
    const callsWhileSubscribed = calls;
    unsubscribe();
    client.advanceClock(1000);

    expect(callsWhileSubscribed).toBeGreaterThan(0);
    expect(calls).toBe(callsWhileSubscribed);
  });
});

describe("WorkerClient — reloj y reinicios", () => {
  it("should expire a short-TTL key when the clock is advanced past its TTL", async () => {
    const shortTtlInput: InputEnvelope = {
      schemaVersion: "1.0.0",
      scenarioId: "reserve-inventory",
      payload: { skuId: "sku_lamp_01", quantity: 2 },
      options: { deterministic: true },
    };
    const reserveKey = "idem_reserve_9a1c";
    await submitAndSettle(client, shortTtlInput);

    client.advanceClock(LIMITS.SHORT_TTL_MS + 1000);

    expect(client.getState().records[reserveKey]?.status).toBe("expired");
    expect(client.getState().transitions.some((t) => t.kind === "expired-key")).toBe(true);
  });

  it("should let a key execute as a first execution again after resetScenario", async () => {
    const first = await submitAndSettle(client, envelope());

    client.resetScenario(KEY);
    const second = await submitAndSettle(client, envelope());

    expect(second.runId).not.toBe(first.runId);
    expect(client.getState().transitions.map((t) => t.kind)).toEqual([
      "first-execution",
      "first-execution",
    ]);
  });

  it("should clear records, transitions and clock back to empty on resetAll", async () => {
    await submitAndSettle(client, envelope());
    client.advanceClock(5000);

    client.resetAll();

    expect(client.getState()).toEqual({ clockMs: 0, records: {}, transitions: [], runCounter: 0 });
  });
});

/**
 * Worker falso mínimo para poder ejercitar la rama con Worker real (jsdom no
 * implementa `Worker`, así que el resto de esta suite corre siempre en modo
 * fallback — ver la cabecera del archivo). Solo implementa lo que
 * WorkerClient usa: addEventListener/postMessage/terminate, más un método
 * de test `emit` para simular el evento "error" que dispara el fallback.
 */
class FakeWorker {
  /** Última instancia construida — así el test no necesita una subclase
   * anónima solo para capturar la referencia (evitaría alias de `this`). */
  static current: FakeWorker | undefined;

  private listeners = new Map<string, Set<(event: unknown) => void>>();

  constructor(_url: URL, _opts?: unknown) {
    FakeWorker.current = this;
  }
  addEventListener(type: string, cb: (event: unknown) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }
  removeEventListener(type: string, cb: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(cb);
  }
  postMessage(_msg: unknown): void {}
  terminate(): void {}
  emit(type: string, event: unknown): void {
    for (const cb of this.listeners.get(type) ?? []) cb(event);
  }
}

describe("WorkerClient — no deja `submit()` colgado para siempre si el Worker falla o se destruye", () => {
  beforeEach(() => {
    FakeWorker.current = undefined;
    vi.stubGlobal("Worker", FakeWorker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should resolve a submit pending on the worker as failed (not hang forever) when the worker emits an error", async () => {
    const workerClient = new WorkerClient();
    const { promise } = workerClient.submit(envelope());
    const fakeWorker = FakeWorker.current;
    expect(fakeWorker).toBeDefined();

    fakeWorker!.emit("error", new Event("error"));

    const output = await promise; // no debe colgarse
    expect(output.status).toBe("failed");
    expect(output.findings.some((f) => f.ruleId === "WORKER_FALLBACK_FAILURE")).toBe(true);

    workerClient.terminate();
  });

  it("should resolve a submit pending on the worker as failed (not hang forever) when terminate() is called", async () => {
    const workerClient = new WorkerClient();
    const { promise } = workerClient.submit(envelope());
    expect(FakeWorker.current).toBeDefined();

    workerClient.terminate();

    const output = await promise; // no debe colgarse
    expect(output.status).toBe("failed");
  });

  it("should stop notifying listeners after terminate()", async () => {
    const workerClient = new WorkerClient();
    let calls = 0;
    workerClient.onState(() => {
      calls += 1;
    });
    const { promise } = workerClient.submit(envelope());
    workerClient.terminate();
    await promise;

    const callsRightAfterTerminate = calls;
    FakeWorker.current!.emit("message", {
      data: { type: "state", state: { clockMs: 999, records: {}, transitions: [], runCounter: 0 } },
    });

    expect(calls).toBe(callsRightAfterTerminate);
  });
});

describe("WorkerClient — concurrencia a través de la fachada", () => {
  it("should answer the second in-flight submit with a concurrent guard", async () => {
    const a = client.submit(envelope());
    const b = client.submit(envelope());

    const outputB = await b.promise;
    await vi.advanceTimersByTimeAsync(LIMITS.PROCESSING_DELAY_MS);
    const outputA = await a.promise;

    expect(outputB.status).toBe("partial");
    expect(outputB.findings.some((f) => f.ruleId === "IDEMP_CONCURRENT_GUARD")).toBe(true);
    expect(outputA.status).toBe("completed");
  });

  it("should resolve a cancelled submit with a cancelled status", async () => {
    const handle = client.submit(envelope());

    client.cancel(handle.requestId);
    const output = await handle.promise;

    expect(output.status).toBe("cancelled");
    expect(client.getState().transitions.map((t) => t.kind)).toEqual(["cancelled"]);
  });
});
