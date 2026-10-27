import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import { promisify } from "util";
import type { ScdiIteration } from "./scdi-traces";

const execAsync = promisify(exec);

export interface ScenarioInfo {
  scenario_id: string;
  source_file: string;
  event_name: string;
  date: string;
  region: string;
  ports: string[];
  severity: "critical" | "high" | "medium" | "low" | string;
  delay_days: number;
  risk_score: number;
  freight_cost: number;
  congestion: number;
  on_time_pct?: number | null;
  event_type?: string;
  raw?: Record<string, string>;
}

export interface LoopState {
  cursor: number;
  last_scenario_id: string | null;
  runs: number;
  last_event?: string;
  last_verdict?: string;
  last_hint?: string;
}

export interface CommodityVulnerability {
  commodity: string;
  vulnerability_score: number;
  impact_description: string;
}

export interface RealtimeAssessment {
  assessment_id: string;
  source_type: "weather" | "natural_disaster" | "geopolitical";
  source_event_id: string;
  event_title: string;
  observed_at: string;
  primary_chokepoint: string;
  region: string;
  affected_ports: string[];
  affected_routes: string[];
  disruption_likelihood: number;
  disruption_likelihood_pct: number;
  disruption_score: number;
  severity_rating: "critical" | "high" | "medium" | "low";
  projected_delay_days: number;
  normal_transit_days: number;
  detour_transit_days: number;
  projected_freight_surge_pct: number;
  estimated_freight_cost_usd: number;
  projected_wait_hours: number;
  projected_backlog_teu: number;
  vulnerable_commodities: CommodityVulnerability[];
  hazard_intensity: number;
  centrality_weight: number;
  substitute_penalty: number;
  recommended_mitigation: string;
  strategic_rationale: string;
}

export interface ChokepointRadarItem {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  centrality: number;
  weather?: {
    wind_speed_kmh: number;
    wind_gusts_kmh: number;
    wave_height_m: number;
    condition: string;
    alert_level: string;
    alert_summary: string;
  } | null;
  current_status: string;
  disruption_score: number;
  disruption_likelihood: number;
}

export interface RealtimeFeedData {
  timestamp: string;
  counts: {
    total_assessments: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    weather_monitors: number;
    disaster_alerts: number;
    geopolitical_events: number;
  };
  chokepoints_radar: ChokepointRadarItem[];
  assessments: RealtimeAssessment[];
  raw_weather: any[];
  raw_disasters: any[];
  raw_geopolitical: any[];
}

export interface TraceData {
  scenario: ScenarioInfo;
  iterations: ScdiIteration[];
}

export function getAgentDir(): string {
  if (process.env.SCDI_AGENT_DIR) {
    return process.env.SCDI_AGENT_DIR;
  }
  // Default to relative from dashboard or explicit path
  return "/home/isahunter/scdi-agent";
}

export async function getLoopState(): Promise<LoopState> {
  const agentDir = getAgentDir();
  const statePath = path.join(agentDir, "output", "loop_state.json");
  try {
    const raw = await fs.readFile(statePath, "utf-8");
    return JSON.parse(raw) as LoopState;
  } catch {
    return { cursor: 0, last_scenario_id: null, runs: 0 };
  }
}

export async function getLatestTrace(): Promise<TraceData | null> {
  const agentDir = getAgentDir();
  const tracesDir = path.join(agentDir, "output", "traces");
  try {
    const files = await fs.readdir(tracesDir);
    // Sort tick files descending
    const tickFiles = files
      .filter((f) => f.startsWith("tick_") && f.endsWith(".json"))
      .sort()
      .reverse();

    const targetFile = tickFiles.length > 0 ? tickFiles[0] : "custom_run.json";
    const filePath = path.join(tracesDir, targetFile);
    const content = await fs.readFile(filePath, "utf-8");
    return JSON.parse(content) as TraceData;
  } catch (err) {
    console.error("Failed to read latest trace:", err);
    return null;
  }
}

let cachedScenarios: ScenarioInfo[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15_000;

export async function getScenarios(forceRefresh = false): Promise<ScenarioInfo[]> {
  const now = Date.now();
  if (!forceRefresh && cachedScenarios && cachedScenarios.length > 0 && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedScenarios;
  }
  const agentDir = getAgentDir();
  try {
    const pyCmd = `python3 -c "import json; from pathlib import Path; from scdi_agent.ingest.loader import load_scenarios; print(json.dumps([s.to_dict() for s in load_scenarios(Path('data/sample'))]))"`;
    const { stdout } = await execAsync(pyCmd, { cwd: agentDir });
    const parsed = JSON.parse(stdout) as ScenarioInfo[];
    cachedScenarios = parsed;
    lastCacheTime = now;
    return parsed;
  } catch (err) {
    console.error("Failed to load scenarios via python:", err);
    return [];
  }
}

export async function executeTick(): Promise<{
  tickOutput: Record<string, unknown>;
  trace: TraceData | null;
}> {
  const agentDir = getAgentDir();
  const cmd = `python3 -m scdi_agent.cli tick --state-file output/loop_state.json --data-dir data/sample`;
  const { stdout } = await execAsync(cmd, { cwd: agentDir });
  let tickOutput: Record<string, unknown> = {};
  try {
    tickOutput = JSON.parse(stdout.trim());
  } catch {
    tickOutput = { raw: stdout };
  }

  const traceFile = tickOutput.trace_file as string | undefined;
  let trace: TraceData | null = null;
  if (traceFile) {
    try {
      const content = await fs.readFile(traceFile, "utf-8");
      trace = JSON.parse(content) as TraceData;
    } catch (err) {
      console.error("Could not read tick trace file:", err);
    }
  }

  if (!trace) {
    trace = await getLatestTrace();
  }

  return { tickOutput, trace };
}

export async function executeRunScenario(scenarioIndex: number): Promise<TraceData | null> {
  const agentDir = getAgentDir();
  const outPath = path.join(agentDir, "output", "traces", "custom_run.json");
  const cmd = `python3 -m scdi_agent.cli run --scenario-index ${scenarioIndex} --export-json output/traces/custom_run.json`;
  await execAsync(cmd, { cwd: agentDir });
  try {
    const content = await fs.readFile(outPath, "utf-8");
    return JSON.parse(content) as TraceData;
  } catch (err) {
    console.error("Could not read custom run trace file:", err);
    return null;
  }
}

let cachedRealtimeFeed: RealtimeFeedData | null = null;
let lastRealtimeFetch = 0;
const REALTIME_CACHE_TTL = 30_000;

export async function getRealtimeFeed(forceRefresh = false): Promise<RealtimeFeedData | null> {
  const now = Date.now();
  if (!forceRefresh && cachedRealtimeFeed && now - lastRealtimeFetch < REALTIME_CACHE_TTL) {
    return cachedRealtimeFeed;
  }
  const agentDir = getAgentDir();
  try {
    const pyCmd = `python3 -m scdi_agent.cli realtime-feed --json ${forceRefresh ? "--force" : ""}`;
    const { stdout } = await execAsync(pyCmd, { cwd: agentDir, maxBuffer: 10 * 1024 * 1024 });
    const parsed = JSON.parse(stdout) as RealtimeFeedData;
    cachedRealtimeFeed = parsed;
    lastRealtimeFetch = now;
    return parsed;
  } catch (err) {
    console.error("Failed to load realtime feed via python CLI:", err);
    return cachedRealtimeFeed;
  }
}

export async function simulateRealtimeDisruption(assessmentId?: string): Promise<{
  success: boolean;
  assessment: RealtimeAssessment;
  scenario: ScenarioInfo;
  iterations: ScdiIteration[];
  final_verdict: string;
  decision_hint: string;
} | null> {
  const agentDir = getAgentDir();
  try {
    const targetArg = assessmentId ? `--assessment-id "${assessmentId}"` : "";
    const pyCmd = `python3 -m scdi_agent.cli realtime-simulate ${targetArg}`;
    const { stdout } = await execAsync(pyCmd, { cwd: agentDir, maxBuffer: 10 * 1024 * 1024 });
    const parsed = JSON.parse(stdout);
    return parsed;
  } catch (err) {
    console.error("Failed to simulate realtime disruption:", err);
    return null;
  }
}
