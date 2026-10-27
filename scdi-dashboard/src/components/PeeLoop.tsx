"use client";

type NodeName = "planner" | "executor" | "evaluator";

interface PeeLoopProps {
  active: NodeName | null;
  done: Partial<Record<NodeName, boolean>>;
  feedbackLit: boolean;
  feedbackText: string;
}

const NODES: { id: NodeName; role: string; name: string }[] = [
  { id: "planner", role: "DAG steps", name: "Planner" },
  { id: "executor", role: "Zetaris / tools", name: "Executor" },
  { id: "evaluator", role: "NIM scoring", name: "Evaluator" },
];

export function PeeLoop({ active, done, feedbackLit, feedbackText }: PeeLoopProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-[#0f1412]/80 p-4 backdrop-blur">
      <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
        {NODES.map((node, i) => (
          <div key={node.id} className="contents">
            <div
              className={[
                "rounded-md border px-3 py-4 text-center transition-all duration-300",
                active === node.id
                  ? "border-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.25)] -translate-y-0.5"
                  : done[node.id]
                    ? "border-emerald-500/40 bg-emerald-500/5"
                    : "border-white/10 bg-white/[0.02]",
              ].join(" ")}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-zinc-500">
                {node.role}
              </div>
              <div className="mt-1 text-base font-semibold text-zinc-100">{node.name}</div>
            </div>
            {i < NODES.length - 1 && (
              <div
                className={[
                  "hidden justify-self-center font-mono text-lg md:block",
                  active === NODES[i + 1].id ? "text-emerald-400" : "text-zinc-600",
                ].join(" ")}
              >
                →
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center">
        <div
          className={[
            "rounded border px-3 py-1.5 font-mono text-[11px] tracking-wide transition-all",
            feedbackLit
              ? "animate-pulse border-amber-500/60 bg-amber-500/10 text-amber-200"
              : "border-dashed border-white/15 text-zinc-500",
          ].join(" ")}
        >
          {feedbackText}
        </div>
      </div>
    </div>
  );
}
