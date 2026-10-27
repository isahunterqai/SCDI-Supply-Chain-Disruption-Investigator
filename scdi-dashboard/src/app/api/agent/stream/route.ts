import { getLatestTrace, getLoopState } from "@/lib/agent-backend";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;
  let heartbeatId: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let lastKnownRuns = -1;

      // 1. Initial snapshot
      try {
        const state = await getLoopState();
        const trace = await getLatestTrace();
        lastKnownRuns = state.runs;
        const payload = JSON.stringify({ state, trace });
        controller.enqueue(encoder.encode(`event: initial\ndata: ${payload}\n\n`));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: "Failed initial read" })}\n\n`
          )
        );
      }

      // 2. Poll for loop state updates
      intervalId = setInterval(async () => {
        try {
          const state = await getLoopState();
          if (state.runs !== lastKnownRuns) {
            lastKnownRuns = state.runs;
            const trace = await getLatestTrace();
            const payload = JSON.stringify({ state, trace });
            controller.enqueue(encoder.encode(`event: tick\ndata: ${payload}\n\n`));
          }
        } catch {
          // ignore transient read errors
        }
      }, 2500);

      // 3. Heartbeat ping
      heartbeatId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // stream closed
        }
      }, 15000);

      // 4. Abort cleanup
      req.signal.addEventListener("abort", () => {
        if (intervalId) clearInterval(intervalId);
        if (heartbeatId) clearInterval(heartbeatId);
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      if (intervalId) clearInterval(intervalId);
      if (heartbeatId) clearInterval(heartbeatId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
