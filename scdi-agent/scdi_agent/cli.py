"""CLI for SCDI historical ingest + PEE simulation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from scdi_agent.export import traces_to_dashboard, write_dashboard_ts, write_json
from scdi_agent.ingest.loader import discover_datasets, load_scenarios
from scdi_agent.loop.pee import run_pee_loop

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA = ROOT / "data" / "sample"
DEFAULT_STATE = ROOT / "output" / "loop_state.json"


def _cmd_list(args: argparse.Namespace) -> int:
    scenarios = load_scenarios(Path(args.data_dir), limit=args.limit)
    found = discover_datasets(Path(args.data_dir))
    print(f"datasets: { {k: str(v) for k, v in found.items()} }")
    print(f"scenarios: {len(scenarios)}")
    for i, scn in enumerate(scenarios):
        print(
            f"[{i}] {scn.scenario_id} | {scn.date} | {scn.severity:8} | "
            f"delay={scn.delay_days:.1f}d risk={scn.risk_score:.2f} | {scn.event_name}"
        )
    return 0


def _cmd_run(args: argparse.Namespace) -> int:
    scenarios = load_scenarios(Path(args.data_dir))
    if not scenarios:
        print("No scenarios loaded", file=sys.stderr)
        return 1
    idx = args.scenario_index
    if idx < 0 or idx >= len(scenarios):
        print(f"scenario-index {idx} out of range 0..{len(scenarios)-1}", file=sys.stderr)
        return 1
    scn = scenarios[idx]
    traces = run_pee_loop(scn)
    print(f"=== SCDI PEE · {scn.event_name} ({scn.scenario_id}) ===\n")
    for t in traces:
        print(f"--- iteration {t.iteration} ({t.state}) ---")
        print(f"Planner: {t.planner}")
        print(f"Executor: {t.executor['tool']} {json.dumps(t.executor['params'])}")
        print(f"Evaluator: {json.dumps(t.evaluator)}")
        print(f"Hint: {t.hint}")
        print(f"Metrics: {json.dumps(t.metrics)}")
        print()
    if args.export_json:
        write_json(
            Path(args.export_json),
            {
                "scenario": scn.to_dict(),
                "iterations": traces_to_dashboard(traces),
            },
        )
        print(f"Wrote {args.export_json}")
    if args.export_ts:
        write_dashboard_ts(Path(args.export_ts), traces, event_name=scn.event_name)
        print(f"Wrote {args.export_ts}")
    return 0


def _cmd_ingest_and_simulate(args: argparse.Namespace) -> int:
    scenarios = load_scenarios(Path(args.data_dir), limit=args.limit)
    print(f"Ingested {len(scenarios)} historical disruption scenarios from {args.data_dir}")
    results = []
    for scn in scenarios:
        traces = run_pee_loop(scn)
        results.append(
            {
                "scenario": scn.to_dict(),
                "iterations": traces_to_dashboard(traces),
                "final_verdict": traces[-1].evaluator["verdict"] if traces else None,
                "decision_hint": traces[-1].hint if traces else None,
            }
        )
        print(
            f"  · {scn.event_name}: {len(traces)} iterations → "
            f"{traces[-1].evaluator['verdict']} ({traces[-1].hint})"
        )

    out = Path(args.export_json or (ROOT / "output" / "traces" / "latest.json"))
    write_json(out, {"count": len(results), "runs": results})
    print(f"Wrote {out}")

    # Prefer a critical/high severity scenario for the live dashboard demo
    demo = next(
        (r for r in results if r["scenario"]["severity"] in {"critical", "high"}),
        results[0] if results else None,
    )
    if demo and args.export_ts:
        from scdi_agent.loop.pee import IterationTrace

        # Rehydrate IterationTrace-like objects for TS writer
        traces = [
            IterationTrace(
                iteration=it["iteration"],
                state=it["state"],
                planner=it["planner"],
                executor=it["executor"],
                evaluator=it["evaluator"],
                metrics=it["metrics"],
                carryover=it["carryover"],
                hint=it["hint"],
                scenario_id=demo["scenario"]["scenario_id"],
                event_name=demo["scenario"]["event_name"],
            )
            for it in demo["iterations"]
        ]
        write_dashboard_ts(
            Path(args.export_ts),
            traces,
            event_name=demo["scenario"]["event_name"],
        )
        print(f"Dashboard demo scenario: {demo['scenario']['event_name']}")
        print(f"Wrote {args.export_ts}")
    return 0


def _cmd_tick(args: argparse.Namespace) -> int:
    """One agent-loop tick: advance to next historical scenario and simulate."""
    state_path = Path(args.state_file)
    data_dir = Path(args.data_dir)
    scenarios = load_scenarios(data_dir)
    if not scenarios:
        print("No scenarios available for tick", file=sys.stderr)
        return 1

    state = {"cursor": 0, "last_scenario_id": None, "runs": 0}
    if state_path.is_file():
        state.update(json.loads(state_path.read_text(encoding="utf-8")))

    cursor = int(state.get("cursor", 0)) % len(scenarios)
    scn = scenarios[cursor]
    traces = run_pee_loop(scn)

    state["cursor"] = (cursor + 1) % len(scenarios)
    state["last_scenario_id"] = scn.scenario_id
    state["last_event"] = scn.event_name
    state["runs"] = int(state.get("runs", 0)) + 1
    state["last_verdict"] = traces[-1].evaluator["verdict"]
    state["last_hint"] = traces[-1].hint
    write_json(state_path, state)

    tick_out = ROOT / "output" / "traces" / f"tick_{state['runs']:04d}_{scn.scenario_id}.json"
    write_json(
        tick_out,
        {"scenario": scn.to_dict(), "iterations": traces_to_dashboard(traces)},
    )

    # Keep dashboard in sync with latest tick when path provided
    if args.export_ts:
        write_dashboard_ts(Path(args.export_ts), traces, event_name=scn.event_name)

    print(
        json.dumps(
            {
                "tick": state["runs"],
                "scenario_id": scn.scenario_id,
                "event": scn.event_name,
                "severity": scn.severity,
                "iterations": len(traces),
                "verdict": state["last_verdict"],
                "hint": state["last_hint"],
                "next_cursor": state["cursor"],
                "trace_file": str(tick_out),
            },
            indent=2,
        )
    )
    return 0


def _cmd_realtime_feed(args: argparse.Namespace) -> int:
    from scdi_agent.realtime import get_realtime_service

    svc = get_realtime_service()
    data = svc.get_realtime_feed(force=args.force)

    if args.json:
        print(json.dumps(data, indent=2))
        return 0

    print("=== Real-Time Supply Chain Disruption Radar ===")
    print(f"Timestamp: {data['timestamp']}")
    print(f"Counts: {data['counts']}\n")

    print("--- Top Predictive Disruption Assessments ---")
    for a in data["assessments"][:8]:
        sev = a["severity_rating"].upper()
        print(
            f"[{sev:8}] {a['event_title']}\n"
            f"  Score: {a['disruption_score']:.2f} | Likelihood: {a['disruption_likelihood_pct']}% | "
            f"Projected Delay: +{a['projected_delay_days']}d | Freight Surge: +{a['projected_freight_surge_pct']}%\n"
            f"  Chokepoint: {a['primary_chokepoint']} | Routes: {','.join(a['affected_routes'])}\n"
            f"  Mitigation: {a['recommended_mitigation']}\n"
        )

    print("--- Global Strategic Chokepoint Weather ---")
    for cp in data["chokepoints_radar"]:
        w = cp.get("weather")
        if w:
            print(
                f"  · {cp['name']:38} | Status: {cp['current_status']:8} | "
                f"Wind: {w['wind_speed_kmh']:.0f} km/h (Gusts: {w['wind_gusts_kmh']:.0f}) | "
                f"Waves: {w['wave_height_m']:.1f}m | {w['condition']}"
            )
    return 0


def _cmd_realtime_simulate(args: argparse.Namespace) -> int:
    from scdi_agent.realtime import get_realtime_service

    svc = get_realtime_service()
    res = svc.simulate_realtime_assessment(
        assessment_id=args.assessment_id,
        export_ts_path=Path(args.export_ts) if args.export_ts else None,
        export_json_path=Path(args.export_json) if args.export_json else None,
    )

    print(json.dumps(res, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="scdi_agent", description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)

    list_p = sub.add_parser("list", help="List ingested historical scenarios")
    list_p.add_argument("--data-dir", default=str(DEFAULT_DATA))
    list_p.add_argument("--limit", type=int, default=None)
    list_p.set_defaults(func=_cmd_list)

    run_p = sub.add_parser("run", help="Run PEE loop on one historical scenario")
    run_p.add_argument("--data-dir", default=str(DEFAULT_DATA))
    run_p.add_argument("--scenario-index", type=int, default=0)
    run_p.add_argument("--export-json", default=None)
    run_p.add_argument("--export-ts", default=None)
    run_p.set_defaults(func=_cmd_run)

    ingest_p = sub.add_parser(
        "ingest-and-simulate",
        help="Ingest Kaggle CSVs and simulate PEE decisions for each scenario",
    )
    ingest_p.add_argument("--data-dir", default=str(DEFAULT_DATA))
    ingest_p.add_argument("--limit", type=int, default=8)
    ingest_p.add_argument(
        "--export-json",
        default=str(ROOT / "output" / "traces" / "latest.json"),
    )
    ingest_p.add_argument(
        "--export-ts",
        default=str(
            ROOT.parent / "scdi-dashboard" / "src" / "lib" / "scdi-traces.generated.ts"
        ),
    )
    ingest_p.set_defaults(func=_cmd_ingest_and_simulate)

    tick_p = sub.add_parser(
        "tick",
        help="Agent-loop tick: ingest next historical scenario and run PEE",
    )
    tick_p.add_argument("--data-dir", default=str(DEFAULT_DATA))
    tick_p.add_argument("--state-file", default=str(DEFAULT_STATE))
    tick_p.add_argument(
        "--export-ts",
        default=str(
            ROOT.parent / "scdi-dashboard" / "src" / "lib" / "scdi-traces.generated.ts"
        ),
    )
    tick_p.set_defaults(func=_cmd_tick)

    rt_feed_p = sub.add_parser(
        "realtime-feed",
        help="Fetch real-time weather, disasters & geopolitical events with predictive SCD ratings",
    )
    rt_feed_p.add_argument("--json", action="store_true", help="Output raw JSON feed")
    rt_feed_p.add_argument("--force", action="store_true", help="Bypass cache")
    rt_feed_p.set_defaults(func=_cmd_realtime_feed)

    rt_sim_p = sub.add_parser(
        "realtime-simulate",
        help="Simulate autonomous PEE agent loop on a live real-time disruption event",
    )
    rt_sim_p.add_argument("--assessment-id", default=None, help="Target assessment ID")
    rt_sim_p.add_argument(
        "--export-ts",
        default=str(
            ROOT.parent / "scdi-dashboard" / "src" / "lib" / "scdi-traces.generated.ts"
        ),
    )
    rt_sim_p.add_argument("--export-json", default=None)
    rt_sim_p.set_defaults(func=_cmd_realtime_simulate)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
