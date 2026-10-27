import { NextResponse } from "next/server";
import { getScenarios } from "@/lib/agent-backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const scenarios = await getScenarios();
    return NextResponse.json({
      count: scenarios.length,
      scenarios,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load scenarios",
      },
      { status: 500 }
    );
  }
}
