/**
 * Compone el banco de pruebas (escenario + payload + opciones + ejecución) y
 * el panel de resultado en una sola cuadrícula de dos columnas en escritorio
 * (40/60, ver 04-sistema-visual-y-accesibilidad.md). Es el único componente
 * con estado real de interacción: los demás son presentacionales.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useEngineClient } from "../hooks/useEngineClient";
import { parsePayloadText } from "../domain/envelope";
import { EngineError } from "../domain/types";
import type { ErrorCode, InputEnvelope, OutputEnvelope, Transition } from "../domain/types";
import { DEFAULT_SCENARIO_ID, INVALID_INPUT_DEMO_TEXT, getScenario } from "../domain/fixtures/scenarios";
import type { ScenarioFixture } from "../domain/types";
import { ScenarioSelector } from "./ScenarioSelector";
import { PayloadEditor } from "./PayloadEditor";
import { DeterministicToggle } from "./DeterministicToggle";
import { ExecuteControls } from "./ExecuteControls";
import { ResultPanel } from "./ResultPanel";
import { PrivacyNote } from "./PrivacyNote";
import { STATUS_LABELS } from "./labels";
import type { RunEntry } from "./runTypes";
import "./Workbench.css";

const DEFAULT_SCENARIO = getScenario(DEFAULT_SCENARIO_ID)!;
const MAX_RUNS_SHOWN = 6;
const MAX_CLOCK_EVENTS_SHOWN = 5;

type ParsedPayload = { ok: true; value: unknown } | { ok: false; message: string; code: ErrorCode };

export function Workbench() {
  const { state, submit, cancel, advanceClock, resetScenario, resetAll } = useEngineClient();

  const [activeScenario, setActiveScenario] = useState<ScenarioFixture>(DEFAULT_SCENARIO);
  const [payloadText, setPayloadText] = useState(() => JSON.stringify(DEFAULT_SCENARIO.initialPayload, null, 2));
  const [deterministic, setDeterministic] = useState(true);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [clockEvents, setClockEvents] = useState<Transition[]>([]);
  const [activePendingId, setActivePendingId] = useState<string | null>(null);
  const [announceMessage, setAnnounceMessage] = useState("");

  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const shownTransitionIds = useRef<Set<string>>(new Set());

  const initialText = useMemo(
    () => JSON.stringify(activeScenario.initialPayload, null, 2),
    [activeScenario]
  );
  const edited = payloadText !== initialText;

  const parsed = useMemo<ParsedPayload>(() => {
    try {
      return { ok: true, value: parsePayloadText(payloadText) };
    } catch (err) {
      if (err instanceof EngineError) {
        return { ok: false, message: err.message, code: err.code };
      }
      return { ok: false, message: "No se pudo interpretar la entrada.", code: "INPUT_INVALID" };
    }
  }, [payloadText]);

  const propertyCount =
    parsed.ok && typeof parsed.value === "object" && parsed.value !== null && !Array.isArray(parsed.value)
      ? Object.keys(parsed.value as Record<string, unknown>).length
      : undefined;

  const inputStateLabel = !parsed.ok
    ? parsed.code === "LIMIT_EXCEEDED"
      ? "Demasiado grande"
      : "Inválida"
    : edited
      ? "Editada"
      : "Inicial";

  const lastRun = runs[0];
  const executionStateLabel = activePendingId
    ? "Procesando"
    : lastRun?.status === "resolved" && lastRun.output
      ? lastRun.output.status === "cancelled"
        ? "Cancelada"
        : "Completada"
      : "Preparada";

  // --- Eventos de reloj huérfanos (expiración proactiva de advanceClock que
  // no pertenece a ninguna ejecución que hayamos lanzado nosotros mismos). ---
  useEffect(() => {
    const knownRunIds = new Set(runs.flatMap((r) => (r.output ? [r.output.runId] : [])));
    const fresh = state.transitions.filter(
      (t) => t.kind === "expired-key" && !knownRunIds.has(t.runId) && !shownTransitionIds.current.has(t.id)
    );
    if (fresh.length === 0) return;
    fresh.forEach((t) => shownTransitionIds.current.add(t.id));
    setClockEvents((prev) => [...fresh, ...prev].slice(0, MAX_CLOCK_EVENTS_SHOWN));
  }, [state.transitions, runs]);

  // --- Escape: cancela una ejecución en curso o colapsa un detalle abierto. ---
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (activePendingId) {
        cancel(activePendingId);
        return;
      }
      const active = document.activeElement;
      let target = (active?.closest("details.expandable[open]") ?? null) as HTMLDetailsElement | null;
      if (!target) {
        const openList = document.querySelectorAll<HTMLDetailsElement>("details.expandable[open]");
        target = openList.length > 0 ? (openList[openList.length - 1] ?? null) : null;
      }
      if (target) target.open = false;
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activePendingId, cancel]);

  function buildInput(payloadValue: unknown): InputEnvelope {
    return {
      schemaVersion: "1.0.0",
      scenarioId: activeScenario.id,
      payload: (payloadValue ?? {}) as Record<string, unknown>,
      options: { deterministic },
    };
  }

  function addRun(entry: RunEntry) {
    setRuns((prev) => [entry, ...prev].slice(0, MAX_RUNS_SHOWN));
  }

  function resolveRun(id: string, output: OutputEnvelope, label: string) {
    setRuns((prev) => prev.map((run) => (run.id === id ? { ...run, status: "resolved", output } : run)));
    setActivePendingId((prev) => (prev === id ? null : prev));
    setAnnounceMessage(`${label}: ${STATUS_LABELS[output.status]}. ${output.summary}`);
  }

  function handleSelectScenario(scenario: ScenarioFixture) {
    setActiveScenario(scenario);
    setPayloadText(JSON.stringify(scenario.initialPayload, null, 2));
  }

  function handleLoadInvalidDemo() {
    setPayloadText(INVALID_INPUT_DEMO_TEXT);
  }

  function handleExecute() {
    if (!parsed.ok) {
      errorSummaryRef.current?.focus();
      return;
    }
    if (activePendingId) return;
    const input = buildInput(parsed.value);
    const { requestId, promise } = submit(input);
    addRun({
      id: requestId,
      label: activeScenario.title,
      scenarioId: activeScenario.id,
      key: activeScenario.idempotencyKey,
      submittedPayload: input.payload,
      status: "pending",
    });
    setActivePendingId(requestId);
    promise.then((output) => resolveRun(requestId, output, activeScenario.title));
  }

  function handleCancel() {
    if (!activePendingId) return;
    cancel(activePendingId);
  }

  function handleConcurrent() {
    if (!parsed.ok) {
      errorSummaryRef.current?.focus();
      return;
    }
    if (activePendingId) return;
    const input = buildInput(parsed.value);
    const labelA = `${activeScenario.title} — solicitud A`;
    const labelB = `${activeScenario.title} — solicitud B (concurrente)`;
    const a = submit(input);
    const b = submit(input);
    addRun({
      id: a.requestId,
      label: labelA,
      scenarioId: activeScenario.id,
      key: activeScenario.idempotencyKey,
      submittedPayload: input.payload,
      status: "pending",
    });
    addRun({
      id: b.requestId,
      label: labelB,
      scenarioId: activeScenario.id,
      key: activeScenario.idempotencyKey,
      submittedPayload: input.payload,
      status: "pending",
    });
    setActivePendingId(a.requestId);
    a.promise.then((output) => resolveRun(a.requestId, output, labelA));
    b.promise.then((output) => resolveRun(b.requestId, output, labelB));
  }

  function handleResetScenario() {
    resetScenario(activeScenario.idempotencyKey);
  }

  function handleResetAll() {
    resetAll();
    setRuns([]);
    setClockEvents([]);
    setActivePendingId(null);
    setAnnounceMessage("");
    setDeterministic(true);
    setPayloadText(initialText);
    shownTransitionIds.current.clear();
  }

  return (
    <div className="workbench-wrapper">
      <div className="app-shell workbench-grid">
        <section id="workbench" aria-labelledby="workbench-heading" className="workbench-section">
          <h2 id="workbench-heading">Banco de pruebas</h2>
          <PrivacyNote />

          <ScenarioSelector
            activeId={activeScenario.id}
            onSelect={handleSelectScenario}
            onLoadInvalidDemo={handleLoadInvalidDemo}
          />

          <PayloadEditor
            ref={errorSummaryRef}
            value={payloadText}
            onChange={setPayloadText}
            stateLabel={inputStateLabel}
            isInvalid={!parsed.ok}
            errorMessage={!parsed.ok ? parsed.message : undefined}
            propertyCount={propertyCount}
          />

          <DeterministicToggle checked={deterministic} onChange={setDeterministic} />

          <ExecuteControls
            isPending={activePendingId !== null}
            executionStateLabel={executionStateLabel}
            scenario={activeScenario}
            onExecute={handleExecute}
            onCancel={handleCancel}
            onConcurrent={handleConcurrent}
            onAdvanceClock={advanceClock}
            onResetScenario={handleResetScenario}
            onResetAll={handleResetAll}
          />
        </section>

        <section id="resultado" aria-labelledby="resultado-heading" className="workbench-section">
          <ResultPanel
            runs={runs}
            clockEvents={clockEvents}
            state={state}
            activeKey={activeScenario.idempotencyKey}
            announceMessage={announceMessage}
          />
        </section>
      </div>
    </div>
  );
}
