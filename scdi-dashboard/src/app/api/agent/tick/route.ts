import { NextResponse } from "next/server";
import { executeTick, getLoopState } from "@/lib/agent-backend";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await executeTick();
    const state = await getLoopState();
    return NextResponse.json({
      success: true,
      tickOutput: result.tickOutput,
      trace: result.trace,
      state,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Tick execution failed",
      },
      { status: 500 }
    );
  }
}
