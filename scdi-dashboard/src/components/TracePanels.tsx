"use client";

import type { ScdiIteration } from "@/lib/scdi-traces";

interface TracePanelsProps {
  iteration: ScdiIteration | null;
}

export function TracePanels({ iteration }: TracePanelsProps) {
  const trace = iteration
    ? {
        trace_id: `trace_scdi_${99810 + iteration.iteration}`,
        iteration: iteration.iteration,
        state: iteration.state,
        planner_thought: iteration.planner,
        executor_action: iteration.executor,
        evaluator_assessment: iteration.evaluator,
        metrics: iteration.metrics,
      }
    : null;

  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-lg border border-white/10 bg-[#0f1412]/80 p-4">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
          Carryover state (into next chunk)
        </h2>
        <pre className="min-h-36 whitespace-pre-wrap font-mono text-xs leading-relaxed text-emerald-100/90">
          {iteration?.carryover ?? "Waiting to run…"}
        </pre>
      </section>
      <section className="rounded-lg border border-white/10 bg-[#0f1412]/80 p-4">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
          Structured JSON trace
        </h2>
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-300">
          {trace ? JSON.stringify(trace, null, 2) : "{}"}
        </pre>
      </section>
    </div>
  );
}
