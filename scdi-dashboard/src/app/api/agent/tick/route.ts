import { NextResponse } from "next/server";
import { executeTick, getLoopState } from "@/lib/agent-backend";
import { trackServerEvent } from "@/lib/app-insights";

export const dynamic = "force-dynamic";

export async function POST() {
  const startTime = Date.now();
  try {
    const result = await executeTick();
    const state = await getLoopState();
    const durationMs = Date.now() - startTime;

    await trackServerEvent("API_Agent_Tick_Executed", {
      scenarioId: result.trace?.scenario?.scenario_id || "unknown",
      event: result.trace?.scenario?.event_name || "unknown",
      verdict: state?.last_verdict || "unknown",
      runs: state?.runs || 0,
    }, {
      durationMs,
      iterationCount: result.trace?.iterations?.length || 0,
    });

    return NextResponse.json({
      success: true,
      tickOutput: result.tickOutput,
      trace: result.trace,
      state,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await trackServerEvent("API_Agent_Tick_Failed", {
      error: error instanceof Error ? error.message : "Tick execution failed",
    }, { durationMs });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tick execution failed",
      },
      { status: 500 }
    );
  }
}
