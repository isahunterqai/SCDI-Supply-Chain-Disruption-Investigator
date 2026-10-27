import { NextRequest, NextResponse } from "next/server";
import { executeRunScenario } from "@/lib/agent-backend";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const index = typeof body.scenarioIndex === "number" ? body.scenarioIndex : 0;
    const trace = await executeRunScenario(index);
    if (!trace) {
      return NextResponse.json(
        { success: false, error: "Failed to generate scenario trace" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      trace,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Run execution failed",
      },
      { status: 500 }
    );
  }
}
