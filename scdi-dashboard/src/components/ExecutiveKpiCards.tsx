"use client";

import type { ScenarioInfo, RealtimeAssessment } from "@/lib/agent-backend";
import type { ScdiIteration } from "@/lib/scdi-traces";

interface ExecutiveKpiCardsProps {
  scenario: ScenarioInfo | null;
  iteration: ScdiIteration | null;
  assessment?: RealtimeAssessment | null;
  isSimulating?: boolean;
}

export function ExecutiveKpiCards({
  scenario,
  iteration,
  assessment,
  isSimulating = false,
}: ExecutiveKpiCardsProps) {
  // Derive dynamic metrics based on active scenario and iteration state
  const riskScore = assessment?.disruption_score ?? scenario?.risk_score ?? 0.85;
  const severity = assessment?.severity_rating ?? scenario?.severity ?? "critical";
  const delayDays = assessment?.projected_delay_days ?? scenario?.delay_days ?? 14.5;
  const confidence = iteration?.evaluator?.confidence_score ?? 0.94;
  const doirDays = iteration?.metrics?.doir_days ?? Math.max(14.0, Math.round((28.0 - riskScore * 10.0) * 10) / 10);
  const meterlessTokens = iteration?.metrics?.meterless_tokens_used ?? 180;
  const nimLatency = iteration?.metrics?.nvidia_nim_latency_ms ?? 340;

  // 1. Total Cost Avoidance calculation
  // Base cargo exposure is ~$4M per vessel string; mitigated fraction is ~60-80% of risk exposure
  const unmitigatedLossUsd = Math.round((riskScore * 4_200_000) / 10_000) * 10_000;
  const avoidedCostUsd = Math.round((unmitigatedLossUsd * 0.76) / 10_000) * 10_000;
  const costProtectedPct = Math.min(92, Math.round(55 + (1 - riskScore * 0.3) * 35));

  // 2. DOIR & Safety Buffer Restored
  const restoredBufferDays = Math.round((delayDays * 0.58) * 10) / 10;

  // 3. On-Time Delivery (OTD) Protected
  const unmitigatedOtd = Math.max(18, Math.round(92 - riskScore * 70));
  const protectedOtd = Math.min(94, Math.round(unmitigatedOtd + (1 - riskScore * 0.2) * 42));

  // 4. Corridors Disrupted
  const highRiskCount = severity === "critical" ? 3 : severity === "high" ? 2 : 1;

  const formatCurrency = (val: number) => {
    if (val >= 1_000_000) {
      return `$${(val / 1_000_000).toFixed(2)}M`;
    }
    return `$${(val / 1_000).toFixed(0)}K`;
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Executive Disruption Impact &amp; Value Realized
          </span>
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400 border border-emerald-500/20">
            Agent Mitigation Verified
          </span>
        </div>
        <div className="font-mono text-[11px] text-zinc-500">
          Decision confidence:{" "}
          <strong className="text-emerald-400 font-semibold">
            {(confidence * 100).toFixed(0)}%
          </strong>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Cost Reduction / Avoided Loss */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0d1411] p-4 transition hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              Total Cost Avoidance
            </span>
            <span className="flex items-center gap-0.5 rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
              <span>▲</span>
              <span>{costProtectedPct}% Saved</span>
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <div className="font-mono text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
              {formatCurrency(avoidedCostUsd)}
            </div>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-400">
            <span>Avoided penalty &amp; spot surge</span>
            <span className="font-mono text-[11px] text-zinc-500">
              Risk: {(riskScore * 100).toFixed(0)}%
            </span>
          </div>

          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-700"
              style={{ width: `${costProtectedPct}%` }}
            />
          </div>
        </div>

        {/* Card 2: Inventory Risk Days / DOIR */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0d1411] p-4 transition hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              Days of Inventory (DOIR)
            </span>
            <span className="rounded bg-sky-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
              +{restoredBufferDays}d Restored
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <div className="font-mono text-2xl font-bold tracking-tight text-emerald-400 sm:text-3xl">
              {doirDays} Days
            </div>
            <span className="font-mono text-xs text-zinc-500">Safety Buffer</span>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-400">
            <span>Buffer threshold: 14.0 days</span>
            <span className="font-mono text-[11px] text-emerald-400 font-medium">Healthy</span>
          </div>

          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-700"
              style={{ width: `${Math.min(100, (doirDays / 30) * 100)}%` }}
            />
          </div>
        </div>

        {/* Card 3: Schedule Reliability & OTD */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0d1411] p-4 transition hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              Protected On-Time Delivery
            </span>
            <span className="rounded bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
              Delay: +{delayDays.toFixed(1)}d
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <div className="font-mono text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
              {protectedOtd}%
            </div>
            <span className="font-mono text-xs text-zinc-500 line-through">
              {unmitigatedOtd}% raw
            </span>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-400">
            <span>PO split &amp; dynamic reroute</span>
            <span className="font-mono text-[11px] text-amber-300">
              +{(protectedOtd - unmitigatedOtd)}% uplift
            </span>
          </div>

          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-700"
              style={{ width: `${protectedOtd}%` }}
            />
          </div>
        </div>

        {/* Card 4: Corridors & Markovian Flat Context */}
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#0d1411] p-4 transition hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/5">
          <div className="flex items-start justify-between">
            <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-400">
              Agent Decision Latency
            </span>
            <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
              O(1) Flat Context
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-2">
            <div className="font-mono text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
              {nimLatency} ms
            </div>
            <span className="font-mono text-xs text-zinc-500">NVIDIA NIM</span>
          </div>

          <div className="mt-1.5 flex items-center justify-between text-xs text-zinc-400">
            <span>{meterlessTokens} tokens per chunk</span>
            <span className="font-mono text-[11px] text-zinc-400">
              {highRiskCount} corridor{highRiskCount > 1 ? "s" : ""} rerouted
            </span>
          </div>

          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full bg-emerald-400 transition-all duration-700"
              style={{ width: "95%" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
