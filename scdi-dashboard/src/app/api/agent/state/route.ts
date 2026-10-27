import { NextResponse } from "next/server";
import { getLatestTrace, getLoopState } from "@/lib/agent-backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const state = await getLoopState();
    const trace = await getLatestTrace();
    return NextResponse.json({
      connected: true,
      state,
      trace,
    });
  } catch (error) {
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
