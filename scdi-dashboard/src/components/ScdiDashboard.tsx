"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SCDI_ITERATIONS, type ScdiIteration } from "@/lib/scdi-traces";
import type {
  LoopState,
  RealtimeAssessment,
  RealtimeFeedData,
  ScenarioInfo,
} from "@/lib/agent-backend";
import { PeeLoop } from "@/components/PeeLoop";
import { IterationTimeline } from "@/components/IterationTimeline";
import { TracePanels } from "@/components/TracePanels";
import { RealtimeDisruptionView } from "@/components/RealtimeDisruptionView";
import { SupplyChainMap } from "@/components/SupplyChainMap";
import { ExecutiveKpiCards } from "@/components/ExecutiveKpiCards";

type NodeName = "planner" | "executor" | "evaluator";
type DashboardMode = "realtime" | "historical";

export function ScdiDashboard() {
  // Mode selection
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("realtime");

  // Live state from backend
  const [loopState, setLoopState] = useState<LoopState | null>(null);
  const [currentScenario, setCurrentScenario] = useState<ScenarioInfo | null>(null);
  const [iterations, setIterations] = useState<ScdiIteration[]>(SCDI_ITERATIONS);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number | "">("");

  // Real-time state
  const [realtimeFeed, setRealtimeFeed] = useState<RealtimeFeedData | null>(null);
  const [selectedAssessment, setSelectedAssessment] = useState<RealtimeAssessment | null>(null);
  const [isSimulatingRealtime, setIsSimulatingRealtime] = useState(false);
  const [isRefreshingRealtime, setIsRefreshingRealtime] = useState(false);

  // Connection & stream status
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "connecting" | "polling" | "disconnected"
  >("connecting");
  const [autoStreaming, setAutoStreaming] = useState(false);
  const [isTicking, setIsTicking] = useState(false);

  // DAG animation state
  const [active, setActive] = useState<NodeName | null>(null);
  const [done, setDone] = useState<Partial<Record<NodeName, boolean>>>({});
  const [feedbackLit, setFeedbackLit] = useState(false);
  const [feedbackText, setFeedbackText] = useState("Refine / Retry feedback");
  const [current, setCurrent] = useState<number | null>(null);
  const [past, setPast] = useState<number[]>([]);
  const [shown, setShown] = useState<ScdiIteration | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [playing, setPlaying] = useState(false);

  const timers = useRef<number[]>([]);
  const autoStreamInterval = useRef<NodeJS.Timeout | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }, []);

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      timers.current.push(window.setTimeout(resolve, ms));
    });

  // Animate DAG through a set of iterations
  const animateIterations = useCallback(
    async (items: ScdiIteration[]) => {
      if (items.length === 0) return;
      clearTimers();
      setPlaying(true);
      setStatus("running");
      setPast([]);
      setDone({});
      setActive(null);

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        setCurrent(it.iteration);
        if (i > 0) {
          setPast((p) => [...p, items[i - 1].iteration]);
        }

        setDone({});
        setFeedbackLit(false);
        setActive("planner");
        await wait(500);

        setDone({ planner: true });
        setActive("executor");
        await wait(550);

        setDone({ planner: true, executor: true });
        setActive("evaluator");
        setShown(it);
        await wait(450);

        setDone({ planner: true, executor: true, evaluator: true });
        setActive(null);

        if (it.evaluator.verdict === "RETRY") {
          setFeedbackLit(true);
          setFeedbackText("RETRY → re-plan with missing evidence");
          await wait(600);
        } else if (it.evaluator.verdict === "CONTINUE") {
          setFeedbackLit(true);
          setFeedbackText("CONTINUE → next bounded Markovian chunk");
          await wait(500);
        } else {
          setFeedbackLit(false);
          setFeedbackText("Criteria passed · final mitigation output");
          await wait(350);
        }
      }

      setPast(items.map((x) => x.iteration));
      setCurrent(items.length);
      setShown(items[items.length - 1]);
      setStatus("completed");
      setPlaying(false);
    },
    [clearTimers]
  );

  // Fetch real-time feed
  const fetchRealtimeData = useCallback(async (force = false) => {
    setIsRefreshingRealtime(true);
    try {
      const res = await fetch(`/api/agent/realtime${force ? "?force=true" : ""}`);
      if (res.ok) {
        const body = await res.json();
        if (body.data) {
          setRealtimeFeed(body.data);
          if (body.data.assessments?.length > 0) {
            setSelectedAssessment((prev) => prev || body.data.assessments[0]);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch real-time feed:", err);
    } finally {
      setIsRefreshingRealtime(false);
    }
  }, []);

  // Initial data load & SSE setup
  useEffect(() => {
    let es: EventSource | null = null;

    async function initData() {
      // 1. Fetch real-time feed
      fetchRealtimeData();

      try {
        // 2. Fetch scenarios list
        const scnRes = await fetch("/api/agent/scenarios");
        if (scnRes.ok) {
          const scnData = await scnRes.json();
          if (scnData.scenarios) {
            setScenarios(scnData.scenarios);
          }
        }

        // 3. Fetch state snapshot
        const stateRes = await fetch("/api/agent/state");
        if (stateRes.ok) {
          const data = await stateRes.json();
          if (data.state) setLoopState(data.state);
          if (data.trace?.scenario) setCurrentScenario(data.trace.scenario);
          if (data.trace?.iterations && data.trace.iterations.length > 0) {
            setIterations(data.trace.iterations);
            setShown(data.trace.iterations[data.trace.iterations.length - 1]);
            setPast(data.trace.iterations.map((x: ScdiIteration) => x.iteration));
          }
          setConnectionStatus("connected");
        }
      } catch (err) {
        console.warn("Initial agent fetch failed:", err);
        setConnectionStatus("disconnected");
      }

      // 4. Connect SSE stream
      try {
        es = new EventSource("/api/agent/stream");

        es.addEventListener("initial", (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.state) setLoopState(data.state);
            if (data.trace?.scenario) setCurrentScenario(data.trace.scenario);
            if (data.trace?.iterations?.length > 0) {
              setIterations(data.trace.iterations);
              setShown(data.trace.iterations[data.trace.iterations.length - 1]);
              setPast(data.trace.iterations.map((x: ScdiIteration) => x.iteration));
            }
            setConnectionStatus("connected");
          } catch (parseErr) {
            console.error("SSE parse error:", parseErr);
          }
        });

        es.addEventListener("tick", (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.state) setLoopState(data.state);
            if (data.trace?.scenario) setCurrentScenario(data.trace.scenario);
            if (data.trace?.iterations?.length > 0) {
              setIterations(data.trace.iterations);
              animateIterations(data.trace.iterations);
            }
            setConnectionStatus("connected");
          } catch (parseErr) {
            console.error("SSE tick parse error:", parseErr);
          }
        });

        es.onerror = () => {
          setConnectionStatus("polling");
        };
      } catch {
        setConnectionStatus("polling");
      }
    }

    initData();

    return () => {
      if (es) es.close();
      clearTimers();
    };
  }, [animateIterations, clearTimers, fetchRealtimeData]);

  // Handle Tick action (advance agent loop by 1 historical disruption)
  const handleTick = async () => {
    if (isTicking || playing) return;
    setIsTicking(true);
    setStatus("ticking");
    try {
      const res = await fetch("/api/agent/tick", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setLoopState(data.state);
        if (data.trace?.scenario) setCurrentScenario(data.trace.scenario);
        if (data.trace?.iterations?.length > 0) {
          setIterations(data.trace.iterations);
          await animateIterations(data.trace.iterations);
        }
      }
    } catch (err) {
      console.error("Agent tick request failed:", err);
    } finally {
      setIsTicking(false);
    }
  };

  // Handle selecting a scenario from the dropdown
  const handleSelectScenario = async (idx: number) => {
    if (isTicking || playing) return;
    setSelectedScenarioIndex(idx);
    setIsTicking(true);
    setStatus("loading-scenario");
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioIndex: idx }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.trace?.scenario) setCurrentScenario(data.trace.scenario);
        if (data.trace?.iterations?.length > 0) {
          setIterations(data.trace.iterations);
          await animateIterations(data.trace.iterations);
        }
      }
    } catch (err) {
      console.error("Scenario run failed:", err);
    } finally {
      setIsTicking(false);
    }
  };

  // Handle simulating a real-time assessment
  const handleSimulateRealtime = async (assessmentId: string) => {
    if (isSimulatingRealtime || playing) return;
    setIsSimulatingRealtime(true);
    setStatus("simulating-realtime");
    try {
      const res = await fetch("/api/agent/realtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.scenario) setCurrentScenario(data.scenario);
        if (data.iterations && data.iterations.length > 0) {
          setIterations(data.iterations);
          await animateIterations(data.iterations);
        }
      }
    } catch (err) {
      console.error("Real-time simulation failed:", err);
    } finally {
      setIsSimulatingRealtime(false);
    }
  };

  // Handle Auto-Streaming toggle
  useEffect(() => {
    if (autoStreaming) {
      autoStreamInterval.current = setInterval(() => {
        if (!isTicking && !playing) {
          handleTick();
        }
      }, 7000);
    } else {
      if (autoStreamInterval.current) {
        clearInterval(autoStreamInterval.current);
        autoStreamInterval.current = null;
      }
    }

    return () => {
      if (autoStreamInterval.current) {
        clearInterval(autoStreamInterval.current);
      }
    };
  }, [autoStreaming, isTicking, playing]);

  const reset = () => {
    clearTimers();
    setPlaying(false);
    setActive(null);
    setDone({});
    setFeedbackLit(false);
    setFeedbackText("Refine / Retry feedback");
    setCurrent(null);
    setPast([]);
    setShown(iterations.length > 0 ? iterations[0] : null);
    setStatus("idle");
  };

  // Helper for severity color
  const getSeverityBadge = (severity?: string) => {
    const s = severity?.toLowerCase();
    if (s === "critical") {
      return "border-rose-500/40 bg-rose-500/10 text-rose-300";
    }
    if (s === "high") {
      return "border-amber-500/40 bg-amber-500/10 text-amber-300";
    }
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      {/* Top Header */}
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-emerald-400">
            SCDI · Supply Chain Disruption Investigator
          </div>

          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-zinc-900/80 px-3 py-1 font-mono text-xs backdrop-blur">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                connectionStatus === "connected"
                  ? "bg-emerald-400 animate-pulse"
                  : connectionStatus === "polling"
                    ? "bg-amber-400"
                    : "bg-zinc-500"
              }`}
            />
            <span className="text-zinc-300">
              {connectionStatus === "connected"
                ? `Agent Live · Tick #${loopState?.runs ?? 0}`
                : connectionStatus === "polling"
                  ? "Polling Agent"
                  : "Agent Offline"}
            </span>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 p-1">
            <button
              type="button"
              onClick={() => setDashboardMode("realtime")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 font-mono text-xs font-semibold transition ${
                dashboardMode === "realtime"
                  ? "bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-400/20"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span>⚡</span>
              <span>Real-Time Disruption Mode (Live)</span>
            </button>

            <button
              type="button"
              onClick={() => setDashboardMode("historical")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 font-mono text-xs font-semibold transition ${
                dashboardMode === "historical"
                  ? "bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-400/20"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <span>📁</span>
              <span>Historical Kaggle Archive ({scenarios.length})</span>
            </button>
          </div>

          <div className="font-mono text-xs text-zinc-400">
            {dashboardMode === "realtime" ? (
              <span className="text-emerald-300">
                ● Ingesting Open-Meteo, USGS, GDACS &amp; Wire Feeds
              </span>
            ) : (
              <span>66 Historical Kaggle Disruption Scenarios (2015–2026)</span>
            )}
          </div>
        </div>

        <div>
          <h1 className="max-w-[20ch] text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
            {dashboardMode === "realtime"
              ? "Real-time disruption & predictive risk radar"
              : "Live agent execution graph"}
          </h1>
          <p className="max-w-2xl text-sm text-zinc-400 mt-1">
            {dashboardMode === "realtime"
              ? "Autonomous Planner ↔ Executor ↔ Evaluator loop driven by live multi-API global weather, natural disaster feeds, and geopolitical current events. Evaluates predictive disruption likelihood and supply chain impact."
              : "Autonomous Planner ↔ Executor ↔ Evaluator loop on bounded Markovian chunks. Ingests Kaggle disruption signals, queries Zetaris data fabric for inventory & alternate routing, and generates executive mitigations."}
          </p>
        </div>

        {/* Historical Mode Action Toolbar */}
        {dashboardMode === "historical" && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Step Next Disruption Button */}
            <button
              type="button"
              onClick={handleTick}
              disabled={isTicking || playing}
              className="flex items-center gap-1.5 rounded bg-emerald-400 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isTicking ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin text-zinc-950"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <span>Ingesting Kaggle Disruption…</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Step Next Disruption (Tick)</span>
                </>
              )}
            </button>

            {/* Auto-Stream Toggle Button */}
            <button
              type="button"
              onClick={() => setAutoStreaming(!autoStreaming)}
              className={`flex items-center gap-1.5 rounded border px-3.5 py-2 text-sm font-medium transition hover:-translate-y-0.5 ${
                autoStreaming
                  ? "border-emerald-400 bg-emerald-500/20 text-emerald-200 shadow-md shadow-emerald-500/10"
                  : "border-white/15 bg-transparent text-zinc-300 hover:border-white/30"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  autoStreaming ? "bg-emerald-400 animate-ping" : "bg-zinc-500"
                }`}
              />
              <span>{autoStreaming ? "Auto-Streaming Active" : "Auto-Stream Loop"}</span>
            </button>

            {/* Replay Trace */}
            <button
              type="button"
              onClick={() => animateIterations(iterations)}
              disabled={playing || isTicking}
              className="rounded border border-white/15 bg-transparent px-3.5 py-2 text-sm font-medium text-zinc-300 transition hover:-translate-y-0.5 hover:border-white/30 disabled:opacity-40"
            >
              Replay Trace
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={reset}
              className="rounded border border-white/15 bg-transparent px-3 py-2 text-sm font-medium text-zinc-400 transition hover:-translate-y-0.5 hover:border-white/30"
            >
              Reset
            </button>

            {/* Scenario Selector Dropdown */}
            {scenarios.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <label htmlFor="scenario-select" className="font-mono text-xs text-zinc-400">
                  Kaggle Scenario:
                </label>
                <select
                  id="scenario-select"
                  value={selectedScenarioIndex}
                  onChange={(e) => handleSelectScenario(Number(e.target.value))}
                  disabled={playing || isTicking}
                  className="max-w-[260px] truncate rounded border border-white/15 bg-[#121915] px-2.5 py-1.5 font-mono text-xs text-zinc-200 outline-none transition focus:border-emerald-400 disabled:opacity-50"
                >
                  <option value="" disabled>
                    Select historical event ({scenarios.length})…
                  </option>
                  {scenarios.map((scn, i) => (
                    <option key={scn.scenario_id} value={i}>
                      [{scn.severity.toUpperCase()}] {scn.event_name} ({scn.date})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Real-time Mode View */}
      {dashboardMode === "realtime" && (
        <section>
          {realtimeFeed ? (
            <RealtimeDisruptionView
              feed={realtimeFeed}
              selectedAssessment={selectedAssessment}
              onSelectAssessment={(a) => setSelectedAssessment(a)}
              onSimulateAssessment={handleSimulateRealtime}
              isSimulating={isSimulatingRealtime}
              onRefresh={() => fetchRealtimeData(true)}
              isRefreshing={isRefreshingRealtime}
            />
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#0e1412] p-8 text-center">
              <div className="inline-block animate-spin text-2xl">🔄</div>
              <p className="mt-2 text-sm text-zinc-400">
                Contacting Open-Meteo, USGS, GDACS and global intelligence feeds…
              </p>
            </div>
          )}
        </section>
      )}

      {/* Active Disruption Banner */}
      {currentScenario && (
        <section className="rounded-lg border border-white/10 bg-[#0c1210]/90 p-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  {currentScenario.source_file.includes("realtime")
                    ? "⚡ Active Simulated Real-Time Disruption"
                    : "📁 Active Historical Disruption"}
                </span>
                <span
                  className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase font-semibold ${getSeverityBadge(
                    currentScenario.severity
                  )}`}
                >
                  {currentScenario.severity}
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  {currentScenario.scenario_id} · {currentScenario.source_file}
                </span>
              </div>
              <h2 className="mt-1 text-lg font-semibold text-zinc-100">
                {currentScenario.event_name}
              </h2>
            </div>
            <div className="flex flex-wrap gap-4 font-mono text-xs">
              <div>
                <span className="text-zinc-500">Date: </span>
                <span className="text-zinc-200 font-medium">{currentScenario.date}</span>
              </div>
              <div>
                <span className="text-zinc-500">Projected Delay: </span>
                <span className="text-rose-400 font-medium">
                  +{currentScenario.delay_days?.toFixed(1)}d
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Risk Score: </span>
                <span className="text-amber-400 font-medium">
                  {(currentScenario.risk_score * 100).toFixed(0)}%
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Ports: </span>
                <span className="text-zinc-200">
                  {currentScenario.ports?.join(", ") || "N/A"}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Interactive Global Supply Chain Route Risk Map */}
      <section>
        <SupplyChainMap
          currentScenario={currentScenario}
          assessment={selectedAssessment}
        />
      </section>

      {/* Executive Impact KPI Summary Cards */}
      <ExecutiveKpiCards
        scenario={currentScenario}
        iteration={shown}
        assessment={selectedAssessment}
        isSimulating={isSimulatingRealtime || isTicking}
      />

      {/* DAG Step Visualizer */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Autonomous PEE Graph Engine (Planner ↔ Executor ↔ Evaluator)
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            Cycle status: <strong className="text-emerald-400">{status}</strong>
          </span>
        </div>
        <PeeLoop
          active={active}
          done={done}
          feedbackLit={feedbackLit}
          feedbackText={feedbackText}
        />
      </section>

      {/* Bounded Markovian Chunks Timeline */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Bounded Markovian Chunks &amp; Carryover Memory
          </span>
          <span className="font-mono text-[11px] text-zinc-500">
            {iterations.length} Iteration Chunks · $O(1)$ Flat Context
          </span>
        </div>
        <IterationTimeline
          iterations={iterations}
          current={current}
          past={past}
          selectedIteration={shown?.iteration}
          onSelectIteration={(it) => setShown(it)}
        />
      </section>

      {/* Trace & Carryover State Panels */}
      <TracePanels iteration={shown} />

      {/* Bottom Telemetry Footer */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-3 font-mono text-xs text-zinc-500">
        <div className="flex flex-wrap gap-4">
          <span>
            Active Chunk:{" "}
            <strong className="font-medium text-zinc-200">
              {shown?.iteration ?? 0}/{iterations.length}
            </strong>
          </span>
          <span>
            Confidence:{" "}
            <strong className="font-medium text-zinc-200">
              {shown ? (shown.evaluator.confidence_score * 100).toFixed(0) + "%" : "—"}
            </strong>
          </span>
          <span>
            Meterless Flat Context:{" "}
            <strong className="font-medium text-emerald-400">
              {shown?.metrics.meterless_tokens_used ?? "—"} tokens
            </strong>
          </span>
          <span>
            NVIDIA NIM Latency:{" "}
            <strong className="font-medium text-zinc-200">
              {shown?.metrics.nvidia_nim_latency_ms ?? "—"} ms
            </strong>
          </span>
        </div>
        <div>
          Loop Status: <strong className="font-medium text-zinc-200">{status}</strong>
        </div>
      </footer>
    </div>
  );
}
