import { NextRequest, NextResponse } from "next/server";
import { executeRunScenario } from "@/lib/agent-backend";
import { trackServerEvent } from "@/lib/app-insights";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const index = typeof body.scenarioIndex === "number" ? body.scenarioIndex : 0;
    const trace = await executeRunScenario(index);
    const durationMs = Date.now() - startTime;

    if (!trace) {
      await trackServerEvent("API_Agent_Run_Failed", {
        scenarioIndex: index,
        reason: "Failed to generate scenario trace",
      }, { durationMs });

      return NextResponse.json(
        { success: false, error: "Failed to generate scenario trace" },
        { status: 500 }
      );
    }

    await trackServerEvent("API_Agent_Run_Executed", {
      scenarioIndex: index,
      scenarioId: trace.scenario.scenario_id,
      event: trace.scenario.event_name,
      severity: trace.scenario.severity,
    }, {
      durationMs,
      delayDays: trace.scenario.delay_days,
      riskScore: trace.scenario.risk_score,
      iterationCount: trace.iterations.length,
    });

    return NextResponse.json({
      success: true,
      trace,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    await trackServerEvent("API_Agent_Run_Exception", {
      error: error instanceof Error ? error.message : "Run execution failed",
    }, { durationMs });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Run execution failed",
      },
      { status: 500 }
    );
  }
}
