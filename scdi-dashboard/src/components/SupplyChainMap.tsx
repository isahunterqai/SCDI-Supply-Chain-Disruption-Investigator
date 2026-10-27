"use client";

import { useMemo, useState } from "react";
import { WORLD_MAP_LAND_PATHS } from "@/lib/world-map-paths";
import type { ScenarioInfo, RealtimeAssessment } from "@/lib/agent-backend";

export interface MapNode {
  id: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  region: string;
  type: "hub_port" | "chokepoint" | "canal";
  normalDelayDays: number;
}

export interface MapRoute {
  id: string;
  name: string;
  origin: string;
  destination: string;
  waypoints?: string[];
  isTransPacific?: boolean;
}

const GLOBAL_NODES: MapNode[] = [
  { id: "shanghai", name: "Shanghai Port Cluster", label: "Shanghai", lat: 31.23, lon: 121.47, region: "East Asia", type: "hub_port", normalDelayDays: 1.5 },
  { id: "ningbo", name: "Ningbo-Zhoushan Port", label: "Ningbo", lat: 29.86, lon: 121.54, region: "East Asia", type: "hub_port", normalDelayDays: 1.2 },
  { id: "busan", name: "Port of Busan", label: "Busan", lat: 35.10, lon: 129.04, region: "East Asia", type: "hub_port", normalDelayDays: 1.0 },
  { id: "kaohsiung", name: "Port of Kaohsiung", label: "Kaohsiung", lat: 22.61, lon: 120.30, region: "East Asia", type: "hub_port", normalDelayDays: 1.1 },
  { id: "singapore", name: "Port of Singapore & Malacca", label: "Singapore", lat: 1.35, lon: 103.82, region: "Southeast Asia", type: "chokepoint", normalDelayDays: 1.2 },
  { id: "suez", name: "Suez Canal / Port Said", label: "Suez", lat: 31.26, lon: 32.30, region: "Middle East", type: "canal", normalDelayDays: 1.5 },
  { id: "jebel_ali", name: "Jebel Ali / Dubai", label: "Jebel Ali", lat: 25.01, lon: 55.06, region: "Middle East", type: "chokepoint", normalDelayDays: 1.4 },
  { id: "rotterdam", name: "Port of Rotterdam", label: "Rotterdam", lat: 51.92, lon: 4.48, region: "Europe", type: "hub_port", normalDelayDays: 1.8 },
  { id: "antwerp", name: "Port of Antwerp-Bruges", label: "Antwerp", lat: 51.22, lon: 4.40, region: "Europe", type: "hub_port", normalDelayDays: 1.5 },
  { id: "hamburg", name: "Port of Hamburg", label: "Hamburg", lat: 53.55, lon: 9.99, region: "Europe", type: "hub_port", normalDelayDays: 1.6 },
  { id: "los_angeles", name: "Port of Los Angeles", label: "Los Angeles", lat: 33.74, lon: -118.27, region: "North America", type: "hub_port", normalDelayDays: 2.2 },
  { id: "long_beach", name: "Port of Long Beach", label: "Long Beach", lat: 33.77, lon: -118.19, region: "North America", type: "hub_port", normalDelayDays: 2.0 },
  { id: "houston", name: "Port of Houston", label: "Houston", lat: 29.76, lon: -95.36, region: "North America", type: "hub_port", normalDelayDays: 1.5 },
  { id: "savannah", name: "Port of Savannah", label: "Savannah", lat: 32.08, lon: -81.09, region: "North America", type: "hub_port", normalDelayDays: 1.6 },
  { id: "baltimore", name: "Port of Baltimore", label: "Baltimore", lat: 39.29, lon: -76.61, region: "North America", type: "hub_port", normalDelayDays: 1.4 },
  { id: "new_york", name: "Port of New York / New Jersey", label: "New York", lat: 40.71, lon: -74.00, region: "North America", type: "hub_port", normalDelayDays: 1.9 },
  { id: "panama", name: "Panama Canal / Balboa", label: "Panama Canal", lat: 8.95, lon: -79.56, region: "Central America", type: "canal", normalDelayDays: 1.2 },
  { id: "cape_good_hope", name: "Cape of Good Hope Bypass", label: "Cape Bypass", lat: -34.35, lon: 18.47, region: "South Africa", type: "chokepoint", normalDelayDays: 0.5 },
];

const GLOBAL_ROUTES: MapRoute[] = [
  { id: "R-PAC-USW", name: "Trans-Pacific Express (Shanghai → LA)", origin: "shanghai", destination: "los_angeles", isTransPacific: true },
  { id: "R-EASIA-USW", name: "North Pacific Route (Busan → Long Beach)", origin: "busan", destination: "long_beach", isTransPacific: true },
  { id: "R-ASIA-EU", name: "Asia-Europe Spine (Singapore → Suez → Rotterdam)", origin: "singapore", destination: "rotterdam", waypoints: ["suez"] },
  { id: "R-ASIA-USE", name: "All-Water East Coast (Ningbo → Panama → Savannah)", origin: "ningbo", destination: "savannah", waypoints: ["panama"] },
  { id: "R-TRANSATL", name: "North Atlantic Corridor (Rotterdam → New York)", origin: "rotterdam", destination: "new_york" },
  { id: "R-GULF-EU", name: "Transatlantic Petrochem (Houston → Antwerp)", origin: "houston", destination: "antwerp" },
  { id: "R-GULF-ASIA", name: "Gulf Energy Corridor (Jebel Ali → Singapore)", origin: "jebel_ali", destination: "singapore" },
  { id: "R-EUR-FEED", name: "North Sea Feeder (Rotterdam → Hamburg)", origin: "rotterdam", destination: "hamburg" },
  { id: "R-EASIA-PAC", name: "Taiwan Strait Corridor (Kaohsiung → Long Beach)", origin: "kaohsiung", destination: "long_beach", isTransPacific: true },
  { id: "R-CAPE-BYPASS", name: "Cape of Good Hope Bypass (Singapore → Cape → Rotterdam)", origin: "singapore", destination: "rotterdam", waypoints: ["cape_good_hope"] },
];

// Helper projection: lon, lat -> SVG (1000x500)
function project(lon: number, lat: number): [number, number] {
  const x = ((lon + 180.0) / 360.0) * 1000.0;
  const y = ((90.0 - lat) / 180.0) * 500.0;
  return [x, y];
}

interface SupplyChainMapProps {
  currentScenario: ScenarioInfo | null;
  assessment?: RealtimeAssessment | null;
  onSelectNode?: (node: MapNode) => void;
}

export function SupplyChainMap({
  currentScenario,
  assessment,
  onSelectNode,
}: SupplyChainMapProps) {
  const [hoveredNode, setHoveredNode] = useState<MapNode | null>(null);
  const [hoveredRoute, setHoveredRoute] = useState<MapRoute | null>(null);
  const [routeFilter, setRouteFilter] = useState<"all" | "disrupted" | "mitigated">("all");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Determine risk for each node
  const nodeRiskMap = useMemo(() => {
    const map: Record<
      string,
      {
        level: "critical" | "high" | "medium" | "low";
        score: number;
        delay: number;
        activeDisruption: string | null;
      }
    > = {};

    const activePorts = [
      ...(currentScenario?.ports || []),
      ...(assessment?.affected_ports || []),
    ].map((p) => p.toLowerCase());

    const activeSeverity = (
      assessment?.severity_rating ||
      currentScenario?.severity ||
      "medium"
    ).toLowerCase() as "critical" | "high" | "medium" | "low";

    const baseScore = assessment?.disruption_score ?? currentScenario?.risk_score ?? 0.2;
    const baseDelay = assessment?.projected_delay_days ?? currentScenario?.delay_days ?? 2.0;
    const eventTitle = assessment?.event_title ?? currentScenario?.event_name ?? null;

    GLOBAL_NODES.forEach((node) => {
      const match =
        activePorts.some(
          (p) =>
            p.includes(node.id) ||
            p.includes(node.label.toLowerCase()) ||
            node.name.toLowerCase().includes(p)
        ) ||
        (assessment?.primary_chokepoint &&
          node.name.toLowerCase().includes(assessment.primary_chokepoint.toLowerCase()));

      if (match) {
        map[node.id] = {
          level: activeSeverity,
          score: baseScore,
          delay: Math.round((node.normalDelayDays + baseDelay) * 10) / 10,
          activeDisruption: eventTitle,
        };
      } else {
        // Normal baseline risk
        map[node.id] = {
          level: "low",
          score: 0.12,
          delay: node.normalDelayDays,
          activeDisruption: null,
        };
      }
    });

    return map;
  }, [currentScenario, assessment]);

  // Determine route statuses
  const routeStatusMap = useMemo(() => {
    const map: Record<string, "disrupted" | "mitigated" | "normal"> = {};
    GLOBAL_ROUTES.forEach((route) => {
      const originRisk = nodeRiskMap[route.origin]?.level || "low";
      const destRisk = nodeRiskMap[route.destination]?.level || "low";
      const waypointRisk = route.waypoints?.some(
        (w) => nodeRiskMap[w]?.level === "critical" || nodeRiskMap[w]?.level === "high"
      );

      if (route.id === "R-CAPE-BYPASS") {
        // Active when Suez is disrupted
        const suezDisrupted =
          nodeRiskMap["suez"]?.level === "critical" ||
          nodeRiskMap["suez"]?.level === "high";
        map[route.id] = suezDisrupted ? "mitigated" : "normal";
      } else if (
        originRisk === "critical" ||
        destRisk === "critical" ||
        originRisk === "high" ||
        destRisk === "high" ||
        waypointRisk
      ) {
        map[route.id] = "disrupted";
      } else {
        map[route.id] = "normal";
      }
    });
    return map;
  }, [nodeRiskMap]);

  // Filter routes
  const visibleRoutes = useMemo(() => {
    return GLOBAL_ROUTES.filter((r) => {
      const status = routeStatusMap[r.id];
      if (routeFilter === "disrupted") return status === "disrupted";
      if (routeFilter === "mitigated") return status === "mitigated";
      return true;
    });
  }, [routeFilter, routeStatusMap]);

  // Node position dictionary
  const nodePos = useMemo(() => {
    const pos: Record<string, [number, number]> = {};
    GLOBAL_NODES.forEach((n) => {
      pos[n.id] = project(n.lon, n.lat);
    });
    return pos;
  }, []);

  const getNodeColor = (level: "critical" | "high" | "medium" | "low") => {
    switch (level) {
      case "critical":
        return "#f43f5e"; // Rose 500
      case "high":
        return "#f59e0b"; // Amber 500
      case "medium":
        return "#38bdf8"; // Sky 400
      default:
        return "#10b981"; // Emerald 500
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#090e0c] shadow-2xl backdrop-blur">
      {/* Map Control Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0c1411]/90 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Global Supply Chain Route Risk Map
          </span>
          <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] text-zinc-400">
            Real-Time Node Dynamic Telemetry
          </span>
        </div>

        {/* Filter Controls & Legend */}
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1 rounded bg-black/40 p-1">
            {(
              [
                { id: "all", label: "All Routes" },
                { id: "disrupted", label: "Disrupted Only" },
                { id: "mitigated", label: "Mitigated Bypass" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRouteFilter(tab.id)}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                  routeFilter === tab.id
                    ? "bg-emerald-400 text-zinc-950 font-bold shadow"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Color Legend */}
          <div className="hidden sm:flex items-center gap-3 border-l border-white/10 pl-3 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-rose-300">Critical</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-amber-300">High</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="text-sky-300">Medium</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-300">Normal</span>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Canvas Map */}
      <div className="relative w-full aspect-[2/1] min-h-[360px] bg-[#070b09]">
        <svg
          viewBox="0 0 1000 500"
          className="h-full w-full select-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradients and Filters */}
            <radialGradient id="oceanGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0d1b15" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#060907" stopOpacity="1" />
            </radialGradient>

            <filter id="glowCritical" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="glowGreen" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Pattern for Lat/Lon Graticule */}
            <pattern id="graticule" width="100" height="100" patternUnits="userSpaceOnUse">
              <path
                d="M 100 0 L 0 0 0 100"
                fill="none"
                stroke="rgba(255, 255, 255, 0.03)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          {/* Background Ocean & Graticule */}
          <rect width="1000" height="500" fill="url(#oceanGlow)" />
          <rect width="1000" height="500" fill="url(#graticule)" />

          {/* Equator & Prime Meridian lines */}
          <line x1="0" y1="250" x2="1000" y2="250" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
          <line x1="500" y1="0" x2="500" y2="500" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

          {/* Natural Earth Landmass Outlines */}
          <g className="landmasses" fill="#13201a" stroke="#1d3128" strokeWidth="0.6">
            {WORLD_MAP_LAND_PATHS.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* Supply Chain Routes */}
          <g className="routes">
            {visibleRoutes.map((route) => {
              const status = routeStatusMap[route.id];
              const p1 = nodePos[route.origin];
              const p2 = nodePos[route.destination];
              if (!p1 || !p2) return null;

              const isHovered = hoveredRoute?.id === route.id;

              let strokeColor = "rgba(56, 189, 248, 0.35)"; // Normal cyan
              let strokeDash = "none";
              let strokeWidth = 1.6;
              let filter = "none";

              if (status === "disrupted") {
                strokeColor = "#f43f5e"; // Rose
                strokeDash = "6 3";
                strokeWidth = isHovered ? 3.0 : 2.2;
                filter = "url(#glowCritical)";
              } else if (status === "mitigated") {
                strokeColor = "#10b981"; // Emerald
                strokeDash = "5 2";
                strokeWidth = isHovered ? 3.2 : 2.4;
                filter = "url(#glowGreen)";
              } else if (isHovered) {
                strokeColor = "#38bdf8";
                strokeWidth = 2.4;
              }

              // Path calculation
              if (route.isTransPacific) {
                // Pacific crossing: from East Asia eastward to right edge, from left edge eastward to West Coast
                const p1x = p1[0];
                const p1y = p1[1];
                const p2x = p2[0];
                const p2y = p2[1];

                const rightTargetY = (p1y + p2y) / 2 - 10;
                const d1 = `M ${p1x} ${p1y} Q ${p1x + 70} ${p1y - 25} 1000 ${rightTargetY}`;
                const d2 = `M 0 ${rightTargetY} Q ${p2x - 70} ${p2y - 25} ${p2x} ${p2y}`;

                return (
                  <g
                    key={route.id}
                    onMouseEnter={() => setHoveredRoute(route)}
                    onMouseLeave={() => setHoveredRoute(null)}
                    className="cursor-pointer transition-all"
                  >
                    <path
                      d={d1}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      filter={filter}
                    />
                    <path
                      d={d2}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={strokeDash}
                      filter={filter}
                    />
                  </g>
                );
              }

              // Routes with waypoints (e.g. Suez or Cape of Good Hope or Panama)
              if (route.waypoints && route.waypoints.length > 0) {
                const wpPos = nodePos[route.waypoints[0]];
                if (wpPos) {
                  // Two arcs: p1 -> wp, wp -> p2
                  const cx1 = (p1[0] + wpPos[0]) / 2;
                  const cy1 = (p1[1] + wpPos[1]) / 2 - (route.id === "R-CAPE-BYPASS" ? -25 : 15);
                  const cx2 = (wpPos[0] + p2[0]) / 2;
                  const cy2 = (wpPos[1] + p2[1]) / 2 - (route.id === "R-CAPE-BYPASS" ? -20 : 15);

                  const d = `M ${p1[0]} ${p1[1]} Q ${cx1} ${cy1} ${wpPos[0]} ${wpPos[1]} Q ${cx2} ${cy2} ${p2[0]} ${p2[1]}`;
                  return (
                    <g
                      key={route.id}
                      onMouseEnter={() => setHoveredRoute(route)}
                      onMouseLeave={() => setHoveredRoute(null)}
                      className="cursor-pointer transition-all"
                    >
                      <path
                        d={d}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDash}
                        filter={filter}
                      />
                    </g>
                  );
                }
              }

              // Direct quadratic curve
              const midX = (p1[0] + p2[0]) / 2;
              const midY = (p1[1] + p2[1]) / 2 - 20;
              const d = `M ${p1[0]} ${p1[1]} Q ${midX} ${midY} ${p2[0]} ${p2[1]}`;

              return (
                <g
                  key={route.id}
                  onMouseEnter={() => setHoveredRoute(route)}
                  onMouseLeave={() => setHoveredRoute(null)}
                  className="cursor-pointer transition-all"
                >
                  <path
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDash}
                    filter={filter}
                  />
                </g>
              );
            })}
          </g>

          {/* Strategic Port & Chokepoint Nodes */}
          <g className="nodes">
            {GLOBAL_NODES.map((node) => {
              const pos = nodePos[node.id];
              if (!pos) return null;
              const [x, y] = pos;
              const risk = nodeRiskMap[node.id];
              const isSelected = selectedNodeId === node.id;
              const isHovered = hoveredNode?.id === node.id;
              const color = getNodeColor(risk.level);

              const isCritical = risk.level === "critical";
              const isHigh = risk.level === "high";

              return (
                <g
                  key={node.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer group"
                  onMouseEnter={() => setHoveredNode(node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    if (onSelectNode) onSelectNode(node);
                  }}
                >
                  {/* Outer Pulsing Aura for Critical/High Risk Nodes */}
                  {(isCritical || isHigh) && (
                    <circle
                      r="12"
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      className="animate-ping opacity-75"
                    />
                  )}

                  {/* Outer target ring */}
                  <circle
                    r={isSelected || isHovered ? "8" : "6"}
                    fill={color}
                    fillOpacity="0.25"
                    stroke={color}
                    strokeWidth="1.2"
                  />

                  {/* Inner Node Core */}
                  <circle
                    r={isSelected || isHovered ? "4" : "3"}
                    fill={color}
                    filter={isCritical ? "url(#glowCritical)" : "none"}
                  />

                  {/* Node Name Label */}
                  <text
                    x="7"
                    y="3"
                    fill={isSelected || isHovered ? "#ffffff" : "#a1a1aa"}
                    fontSize="8"
                    fontFamily="monospace"
                    fontWeight={isCritical || isSelected ? "bold" : "normal"}
                    className="pointer-events-none drop-shadow"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover / Active Node Tooltip Card */}
        {hoveredNode && (
          <div
            className="pointer-events-none absolute bottom-4 left-4 z-20 w-80 rounded-lg border border-white/15 bg-[#0d1411]/95 p-3.5 shadow-2xl backdrop-blur"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] uppercase text-zinc-400">
                  {hoveredNode.region} · {hoveredNode.type.replace("_", " ")}
                </span>
                <h4 className="text-sm font-semibold text-zinc-100">{hoveredNode.name}</h4>
              </div>
              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                  nodeRiskMap[hoveredNode.id]?.level === "critical"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : nodeRiskMap[hoveredNode.id]?.level === "high"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                }`}
              >
                {nodeRiskMap[hoveredNode.id]?.level} Risk
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/5 pt-2 font-mono text-xs text-zinc-400">
              <div>
                Delay Impact:{" "}
                <span className="font-semibold text-zinc-200">
                  +{nodeRiskMap[hoveredNode.id]?.delay} days
                </span>
              </div>
              <div>
                Risk Index:{" "}
                <span className="font-semibold text-zinc-200">
                  {(nodeRiskMap[hoveredNode.id]?.score * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {nodeRiskMap[hoveredNode.id]?.activeDisruption ? (
              <div className="mt-2 rounded bg-rose-500/10 p-1.5 font-mono text-[11px] text-rose-300 border border-rose-500/20">
                ⚠️ Disruption: {nodeRiskMap[hoveredNode.id]?.activeDisruption}
              </div>
            ) : (
              <div className="mt-2 font-mono text-[11px] text-emerald-400">
                ✓ Normal port operations &amp; berthing throughput
              </div>
            )}
          </div>
        )}

        {/* Hover Route Tooltip Card */}
        {hoveredRoute && !hoveredNode && (
          <div
            className="pointer-events-none absolute bottom-4 left-4 z-20 w-80 rounded-lg border border-white/15 bg-[#0d1411]/95 p-3.5 shadow-2xl backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase text-zinc-400">
                Maritime Corridor
              </span>
              <span
                className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                  routeStatusMap[hoveredRoute.id] === "disrupted"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : routeStatusMap[hoveredRoute.id] === "mitigated"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                }`}
              >
                {routeStatusMap[hoveredRoute.id]}
              </span>
            </div>
            <h4 className="mt-1 text-sm font-semibold text-zinc-100">
              {hoveredRoute.name}
            </h4>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {hoveredRoute.id} · Origin: {hoveredRoute.origin} → Dest: {hoveredRoute.destination}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
