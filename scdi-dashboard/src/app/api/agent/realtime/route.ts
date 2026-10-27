import { NextRequest, NextResponse } from "next/server";
import { getRealtimeFeed, simulateRealtimeDisruption } from "@/lib/agent-backend";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";
    const feed = await getRealtimeFeed(force);

    if (!feed) {
      return NextResponse.json(
        { success: false, error: "Failed to fetch real-time feed" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: feed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error fetching real-time data",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let assessmentId: string | undefined;
    try {
      const body = await request.json();
      assessmentId = body.assessmentId;
    } catch {
      // Empty body is fine; defaults to highest severity assessment
    }

    const result = await simulateRealtimeDisruption(assessmentId);
    if (!result || !result.success) {
      return NextResponse.json(
        { success: false, error: "Simulation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal simulation error",
      },
      { status: 500 }
    );
  }
}
