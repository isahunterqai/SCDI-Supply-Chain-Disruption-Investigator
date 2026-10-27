"use client";

import { useState } from "react";
import type {
  ChokepointRadarItem,
  RealtimeAssessment,
  RealtimeFeedData,
} from "@/lib/agent-backend";

interface RealtimeDisruptionViewProps {
  feed: RealtimeFeedData;
  selectedAssessment: RealtimeAssessment | null;
  onSelectAssessment: (assessment: RealtimeAssessment) => void;
  onSimulateAssessment: (assessmentId: string) => Promise<void>;
  isSimulating: boolean;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
}

export function RealtimeDisruptionView({
  feed,
  selectedAssessment,
  onSelectAssessment,
  onSimulateAssessment,
  isSimulating,
  onRefresh,
  isRefreshing,
}: RealtimeDisruptionViewProps) {
  const [activeCategory, setActiveCategory] = useState<
    "all" | "weather" | "natural_disaster" | "geopolitical"
  >("all");
  const [selectedChokepointFilter, setSelectedChokepointFilter] = useState<string | null>(null);

  const filteredAssessments = feed.assessments.filter((a) => {
    if (activeCategory !== "all" && a.source_type !== activeCategory) {
      return false;
    }
    if (selectedChokepointFilter) {
      const match =
        a.primary_chokepoint.toLowerCase().includes(selectedChokepointFilter.toLowerCase()) ||
        a.source_event_id.toLowerCase().includes(selectedChokepointFilter.toLowerCase());
      if (!match) return false;
    }
    return true;
  });

  const activeAssessment = selectedAssessment || filteredAssessments[0] || feed.assessments[0];

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "border-rose-500/40 bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30";
      case "high":
        return "border-amber-500/40 bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/30";
      case "medium":
        return "border-sky-500/40 bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30";
      default:
        return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30";
    }
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "weather":
        return "🌊";
      case "natural_disaster":
        return "🌋";
      case "geopolitical":
        return "⚔️";
      default:
        return "⚠️";
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-[#0d1311] p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Live Disruption Mode
              </span>
              <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
                APIs: Open-Meteo · USGS · GDACS · Global Wire
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Last ingestion: <span className="font-mono text-zinc-300">{feed.timestamp}</span> ·{" "}
              {feed.counts.total_assessments} active predictive assessments
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick stats chips */}
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-rose-300">
              {feed.counts.critical} Critical
            </span>
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-amber-300">
              {feed.counts.high} High
            </span>
            <span className="rounded border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-sky-300">
              {feed.counts.medium} Medium
            </span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 transition hover:bg-white/10 hover:border-white/30 disabled:opacity-50"
          >
            <span className={isRefreshing ? "animate-spin inline-block" : ""}>🔄</span>
            <span>{isRefreshing ? "Refreshing Feeds…" : "Force Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Global Strategic Chokepoints Radar */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-200">
              Global Maritime Chokepoints & Hub Status
            </span>
            <span className="font-mono text-xs text-zinc-500">
              (Live sea state & atmospheric wind feeds)
            </span>
          </div>
          {selectedChokepointFilter && (
            <button
              type="button"
              onClick={() => setSelectedChokepointFilter(null)}
              className="font-mono text-xs text-emerald-400 underline hover:text-emerald-300"
            >
              Clear filter ({selectedChokepointFilter})
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          {feed.chokepoints_radar.map((cp: ChokepointRadarItem) => {
            const isSelected = selectedChokepointFilter === cp.id;
            const w = cp.weather;
            const statusClass =
              cp.current_status === "critical"
                ? "border-rose-500/40 bg-rose-500/[0.06] text-rose-300"
                : cp.current_status === "high" || cp.current_status === "warning"
                ? "border-amber-500/40 bg-amber-500/[0.06] text-amber-300"
                : cp.current_status === "medium" || cp.current_status === "advisory"
                ? "border-sky-500/40 bg-sky-500/[0.06] text-sky-300"
                : "border-white/10 bg-white/[0.02] text-zinc-300";

            return (
              <button
                key={cp.id}
                type="button"
                onClick={() =>
                  setSelectedChokepointFilter(isSelected ? null : cp.id)
                }
                className={`flex flex-col justify-between rounded-lg border p-2.5 text-left transition hover:border-white/30 ${statusClass} ${
                  isSelected ? "ring-2 ring-emerald-400 shadow-md shadow-emerald-500/10" : ""
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-mono text-[11px] font-semibold text-zinc-100">
                      {cp.name.split("/")[0].trim()}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 font-mono text-[9px] uppercase font-bold ${
                        cp.current_status === "critical"
                          ? "bg-rose-500/30 text-rose-200"
                          : cp.current_status === "high"
                          ? "bg-amber-500/30 text-amber-200"
                          : "bg-white/10 text-zinc-300"
                      }`}
                    >
                      {cp.current_status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-zinc-400 line-clamp-1">
                    {w ? w.condition : cp.region}
                  </div>
                </div>

                {w ? (
                  <div className="mt-2 border-t border-white/5 pt-1.5 font-mono text-[10px] text-zinc-400">
                    <div>
                      Wind: <span className="text-zinc-200">{w.wind_speed_kmh} km/h</span>{" "}
                      (G: <span className="text-zinc-200">{w.wind_gusts_kmh}</span>)
                    </div>
                    <div>
                      Waves: <span className="text-zinc-200">{w.wave_height_m}m</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 border-t border-white/5 pt-1.5 font-mono text-[10px] text-zinc-500">
                    Telemetry synced
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Real-time Section: Live Feed List & Predictive Analysis Deep Dive */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column: Live Event Stream (5 cols) */}
        <div className="space-y-3 lg:col-span-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-200">
              Live Threat Feed ({filteredAssessments.length})
            </span>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 border-b border-white/10 pb-2">
            {[
              { id: "all", label: "All Feeds", icon: "🌐" },
              { id: "geopolitical", label: "Geopolitical", icon: "⚔️" },
              { id: "natural_disaster", label: "Disasters", icon: "🌋" },
              { id: "weather", label: "Weather", icon: "🌊" },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id as any)}
                className={`flex items-center gap-1 rounded px-2.5 py-1 font-mono text-xs transition ${
                  activeCategory === cat.id
                    ? "bg-emerald-400/20 text-emerald-300 font-semibold border border-emerald-400/40"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Event Cards List */}
          <div className="max-h-[580px] space-y-2 overflow-y-auto pr-1">
            {filteredAssessments.length === 0 ? (
              <div className="rounded border border-dashed border-white/10 p-6 text-center text-xs text-zinc-500">
                No active threats matching current filters.
              </div>
            ) : (
              filteredAssessments.map((a) => {
                const isSelected = activeAssessment?.assessment_id === a.assessment_id;
                return (
                  <div
                    key={a.assessment_id}
                    onClick={() => onSelectAssessment(a)}
                    className={`cursor-pointer rounded-lg border p-3 transition hover:border-white/30 ${
                      isSelected
                        ? "border-emerald-400/60 bg-[#14201a] shadow-lg shadow-emerald-500/10"
                        : "border-white/10 bg-[#0e1412] hover:bg-[#121915]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span>{getSourceIcon(a.source_type)}</span>
                        <span className="uppercase text-zinc-400">
                          {a.source_type.replace("_", " ")}
                        </span>
                      </div>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${getSeverityBadgeClass(
                          a.severity_rating
                        )}`}
                      >
                        {a.severity_rating}
                      </span>
                    </div>

                    <div className="mt-1.5 text-xs font-medium text-zinc-100 line-clamp-2">
                      {a.event_title}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 font-mono text-[11px] text-zinc-400">
                      <div>
                        Score:{" "}
                        <span className="font-semibold text-zinc-200">
                          {a.disruption_score.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        Likelihood:{" "}
                        <span className="font-semibold text-emerald-400">
                          {a.disruption_likelihood_pct}%
                        </span>
                      </div>
                      <div>
                        Delay:{" "}
                        <span className="font-semibold text-amber-300">
                          +{a.projected_delay_days}d
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Predictive Analysis & SCD Impact Model (7 cols) */}
        {activeAssessment && (
          <div className="space-y-4 rounded-xl border border-white/10 bg-[#0e1412] p-5 lg:col-span-7">
            {/* Top Bar with Severity & Simulation CTA */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-2.5 py-0.5 font-mono text-xs font-bold uppercase ${getSeverityBadgeClass(
                      activeAssessment.severity_rating
                    )}`}
                  >
                    {activeAssessment.severity_rating} SEVERITY
                  </span>
                  <span className="font-mono text-xs text-zinc-400">
                    ID: {activeAssessment.assessment_id.slice(0, 16)}
                  </span>
                </div>
                <h3 className="mt-1 text-base font-semibold text-zinc-100">
                  {activeAssessment.event_title}
                </h3>
              </div>

              {/* Action Button: Ingest into Agent Loop */}
              <button
                type="button"
                onClick={() => onSimulateAssessment(activeAssessment.assessment_id)}
                disabled={isSimulating}
                className="flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 font-mono text-xs font-bold text-zinc-950 shadow-lg shadow-emerald-400/20 transition hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>⚡</span>
                <span>
                  {isSimulating ? "Running PEE Agent Loop…" : "Simulate Agent Mitigation"}
                </span>
              </button>
            </div>

            {/* Predictive Model Gauges & Score Matrix */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                <div className="font-mono text-[10px] uppercase text-zinc-400">
                  Disruption Score
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-zinc-100">
                  {activeAssessment.disruption_score.toFixed(2)}
                </div>
                <div className="font-mono text-[10px] text-zinc-500">Scale 0.00 – 1.00</div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                <div className="font-mono text-[10px] uppercase text-zinc-400">
                  Likelihood (P)
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-emerald-400">
                  {activeAssessment.disruption_likelihood_pct}%
                </div>
                <div className="font-mono text-[10px] text-zinc-500">Predictive Probability</div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                <div className="font-mono text-[10px] uppercase text-zinc-400">
                  Projected Delay
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-amber-300">
                  +{activeAssessment.projected_delay_days}d
                </div>
                <div className="font-mono text-[10px] text-zinc-500">
                  Normal: {activeAssessment.normal_transit_days}d · Detour:{" "}
                  {activeAssessment.detour_transit_days}d
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                <div className="font-mono text-[10px] uppercase text-zinc-400">
                  Freight Rate Surge
                </div>
                <div className="mt-1 font-mono text-2xl font-bold text-rose-300">
                  +{activeAssessment.projected_freight_surge_pct}%
                </div>
                <div className="font-mono text-[10px] text-zinc-500">
                  ~${activeAssessment.estimated_freight_cost_usd.toLocaleString()}/FEU
                </div>
              </div>
            </div>

            {/* Port & Routing Impact Details */}
            <div className="rounded-lg border border-white/10 bg-black/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-zinc-400">Primary Strategic Chokepoint:</span>
                <span className="font-semibold text-zinc-200">
                  {activeAssessment.primary_chokepoint}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-zinc-400">Affected Key Corridors:</span>
                <span className="font-semibold text-emerald-300">
                  {activeAssessment.affected_routes.join(", ")}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-zinc-400">Ports at Risk:</span>
                <span className="font-semibold text-zinc-300">
                  {activeAssessment.affected_ports.join(", ")}
                </span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-zinc-400">Port Wait Time / Dwell:</span>
                <span className="font-semibold text-amber-300">
                  +{activeAssessment.projected_wait_hours}h (Est. backlog:{" "}
                  {activeAssessment.projected_backlog_teu.toLocaleString()} TEU)
                </span>
              </div>
            </div>

            {/* Vulnerable Commodities Breakdown */}
            <div>
              <div className="mb-1.5 font-mono text-xs font-semibold uppercase text-zinc-400">
                Critical Commodity Vulnerabilities
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {activeAssessment.vulnerable_commodities.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded border border-white/10 bg-white/[0.02] p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-zinc-200">
                        {item.commodity}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-amber-400">
                        {(item.vulnerability_score * 100).toFixed(0)}% Vulnerability
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-zinc-400 leading-snug">
                      {item.impact_description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic Rationale & Tactical Mitigation */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase text-emerald-400">
                <span>🤖</span>
                <span>Autonomous Agent Mitigation Strategy</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                {activeAssessment.recommended_mitigation}
              </p>
              <div className="border-t border-emerald-500/10 pt-1.5 font-mono text-[11px] text-zinc-400">
                <span className="text-zinc-500">Rationale: </span>
                {activeAssessment.strategic_rationale}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
