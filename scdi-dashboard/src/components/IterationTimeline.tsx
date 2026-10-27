"use client";

import type { ScdiIteration } from "@/lib/scdi-traces";

interface IterationTimelineProps {
  iterations: ScdiIteration[];
  current: number | null;
  past: number[];
  onSelectIteration?: (iteration: ScdiIteration) => void;
  selectedIteration?: number | null;
}

export function IterationTimeline({
  iterations,
  current,
  past,
  onSelectIteration,
  selectedIteration,
}: IterationTimelineProps) {
  return (
    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
      {iterations.map((it) => {
        const isCurrent = current === it.iteration;
        const isPast = past.includes(it.iteration);
        const isSelected = selectedIteration === it.iteration;
        const conf = it.evaluator.confidence_score;
        const meterTone =
          conf < 0.5 ? "bg-rose-500" : conf < 0.9 ? "bg-amber-400" : "bg-emerald-400";

        return (
          <div
            key={it.iteration}
            onClick={() => onSelectIteration?.(it)}
            role={onSelectIteration ? "button" : undefined}
            tabIndex={onSelectIteration ? 0 : undefined}
            className={[
              "rounded-lg border p-3 transition-all duration-300 text-left",
              onSelectIteration ? "cursor-pointer hover:border-emerald-400/50" : "",
              isSelected ? "ring-2 ring-emerald-400/80 border-emerald-400" : "",
              isCurrent
                ? "border-emerald-400/70 bg-emerald-500/10 -translate-y-0.5 shadow-lg shadow-black/30"
                : isPast
                  ? "border-white/10 bg-white/[0.03] opacity-90"
                  : "border-white/10 bg-white/[0.02] opacity-40",
            ].join(" ")}
          >
            <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              <span>Chunk {it.iteration} · Markovian</span>
              {isSelected && (
                <span className="text-[9px] text-emerald-400 font-medium">Viewing</span>
              )}
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-100">
              {it.evaluator.verdict}
            </div>
            <div className="mt-0.5 text-xs text-zinc-400 line-clamp-2">{it.hint}</div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full ${meterTone} transition-all duration-500`}
                style={{ width: isCurrent || isPast ? `${Math.round(conf * 100)}%` : "0%" }}
              />
            </div>
            {it.metrics.doir_days != null && (
              <div className="mt-2 font-mono text-[11px] text-zinc-500">
                DOIR {it.metrics.doir_days}d · burn {it.metrics.burn_rate_units_per_day}/d
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
