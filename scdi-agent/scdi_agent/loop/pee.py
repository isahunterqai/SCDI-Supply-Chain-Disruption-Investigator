"""Planner ↔ Executor ↔ Evaluator loop driven by historical disruption scenarios."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Literal

from scdi_agent.ingest.loader import DisruptionScenario
from scdi_agent.telemetry import get_telemetry_client
from scdi_agent.tools.inventory import InventorySnapshot, model_inventory_impact

Verdict = Literal["RETRY", "CONTINUE", "PROCEED_TO_FINAL_OUTPUT"]


@dataclass
class IterationTrace:
    iteration: int
    state: str
    planner: str
    executor: dict[str, Any]
    evaluator: dict[str, Any]
    metrics: dict[str, Any]
    carryover: str
    hint: str
    scenario_id: str = ""
    event_name: str = ""

    def to_dashboard(self) -> dict[str, Any]:
        """Shape matching scdi-dashboard ScdiIteration."""
        return {
            "iteration": self.iteration,
            "state": self.state,
            "planner": self.planner,
            "executor": self.executor,
            "evaluator": self.evaluator,
            "metrics": self.metrics,
            "carryover": self.carryover,
            "hint": self.hint,
        }


@dataclass
class LoopState:
    missing_evidence: list[str] = field(default_factory=list)
    confidence: float = 0.0
    retry_count: int = 0
    inventory: InventorySnapshot | None = None
    contracts_loaded: bool = False
    report_emitted: bool = False


def _primary_port(scenario: DisruptionScenario) -> str:
    return scenario.ports[0] if scenario.ports else "UNKNOWN"


def _carryover(
    *,
    completed: str,
    remaining: str,
    decisions: str,
    confidence: float,
    retry_count: int,
    missing: list[str],
    doir: float | None,
    extra: str = "",
) -> str:
    ctx = (
        f"confidence_score={confidence:.2f}; retry_count={retry_count}; "
        f"missing_evidence=[{','.join(missing)}]"
    )
    if doir is not None:
        ctx += f"; doir_days={doir}"
    if extra:
        ctx += f"; {extra}"
    return "\n".join(
        [
            f"COMPLETED: {completed}",
            f"REMAINING: {remaining}",
            f"DECISIONS: {decisions}",
            f"CONTEXT: {ctx}",
        ]
    )


def plan(scenario: DisruptionScenario, state: LoopState, step: int) -> str:
    port = _primary_port(scenario)
    if step == 0:
        return (
            f"Parse historical disruption '{scenario.event_name}' ({scenario.date}, "
            f"{scenario.severity}). Map inbound SKUs at {port} to warehouse burn rates. "
            f"Query Zetaris ERP for open POs and DOIR under {scenario.delay_days:.1f}d delay."
        )
    if state.missing_evidence:
        return (
            f"Iteration {step} missing {', '.join(state.missing_evidence)}. "
            f"Re-route Zetaris to contracts shard; compute DOIR recovery under "
            f"{scenario.event_type} delay scenarios for {port}."
        )
    return (
        f"Evidence complete for {scenario.event_name}. Synthesize NLP executive report: "
        f"strike/disruption impact, DOIR trajectory, recommended PO reallocation."
    )


def execute(scenario: DisruptionScenario, state: LoopState, step: int) -> dict[str, Any]:
    port = _primary_port(scenario)
    budget = max(0.4, 0.95 - step * 0.12 - scenario.risk_score * 0.05)
    if step == 0:
        return {
            "tool": "zetaris_federated_sql_query",
            "params": {
                "query": (
                    "SELECT sku, on_hand, daily_burn, po_eta FROM erp.inventory i "
                    "JOIN erp.purchase_orders p ON i.sku=p.sku "
                    f"WHERE p.origin_port='{port}' AND disruption_date='{scenario.date}'"
                ),
                "endpoint": "primary",
                "meterless_cost_budget_remaining": round(budget, 2),
                "kaggle_source": scenario.source_file,
                "scenario_id": scenario.scenario_id,
            },
        }
    if state.missing_evidence or not state.contracts_loaded:
        skus = state.inventory.sku if state.inventory else "strike_exposure"
        return {
            "tool": "zetaris_federated_sql_query",
            "params": {
                "query": (
                    "SELECT vendor_id, sku, lead_time_days, capacity FROM erp.backup_contracts "
                    f"WHERE sku IN (SELECT sku FROM strike_exposure WHERE port='{port}')"
                ),
                "endpoint": "secondary",
                "meterless_cost_budget_remaining": round(budget, 2),
                "exposed_sku": skus,
                "scenario_id": scenario.scenario_id,
            },
        }
    return {
        "tool": "emit_executive_report",
        "params": {
            "format": "structured_json",
            "audience": "supply_chain_vp",
            "meterless_cost_budget_remaining": round(budget, 2),
            "event": scenario.event_name,
            "scenario_id": scenario.scenario_id,
        },
    }


def evaluate(
    scenario: DisruptionScenario,
    state: LoopState,
    action: dict[str, Any],
    step: int,
) -> tuple[dict[str, Any], LoopState, str]:
    """Return (evaluator_dict, new_state, hint). Mutates inventory via tools."""
    inv = state.inventory or model_inventory_impact(scenario)
    tokens = 1100 + step * 360 + int(scenario.risk_score * 200)
    latency = 45 + step * 6 + int(scenario.congestion * 20)

    # Step 0: primary ERP often incomplete for high-severity historical shocks
    if step == 0:
        missing = ["backup_contracts", "alt_lane_capacity"]
        conf = max(0.28, 0.55 - scenario.risk_score * 0.25)
        # Critical historical events always force a retry to demonstrate recovery
        if scenario.severity in {"critical", "high"} or inv.projected_doir_after_delay < 7:
            new_state = LoopState(
                missing_evidence=missing,
                confidence=conf,
                retry_count=state.retry_count + 1,
                inventory=inv,
            )
            ev = {
                "data_complete": False,
                "confidence_score": round(conf, 2),
                "missing_evidence_detected": True,
                "verdict": "RETRY",
            }
            hint = (
                f"Historical {scenario.severity} shock → DOIR {inv.projected_doir_after_delay}d; "
                "missing backup contracts + alt lane capacity"
            )
            return ev, new_state, hint

    # Step 1: load contracts / alt lane from secondary shard
    if not state.contracts_loaded and (state.missing_evidence or step == 1):
        conf = min(0.94, 0.72 + (1.0 - scenario.risk_score) * 0.2)
        new_state = LoopState(
            missing_evidence=[],
            confidence=conf,
            retry_count=state.retry_count,
            inventory=inv,
            contracts_loaded=True,
        )
        ev = {
            "data_complete": True,
            "confidence_score": round(conf, 2),
            "missing_evidence_detected": False,
            "verdict": "CONTINUE",
        }
        hint = (
            f"Backup {inv.backup_vendor} via {inv.alt_lane} recovers DOIR to "
            f"{inv.recovery_doir} days (hist delay {scenario.delay_days:.1f}d)"
        )
        return ev, new_state, hint

    # Final: emit report
    conf = min(0.99, 0.9 + state.confidence * 0.08)
    new_state = LoopState(
        missing_evidence=[],
        confidence=conf,
        retry_count=state.retry_count,
        inventory=inv,
        contracts_loaded=True,
        report_emitted=True,
    )
    ev = {
        "data_complete": True,
        "confidence_score": round(conf, 2),
        "missing_evidence_detected": False,
        "verdict": "PROCEED_TO_FINAL_OUTPUT",
    }
    hint = (
        f"Mitigation accepted for {scenario.event_name}: reallocate PO to "
        f"{inv.backup_vendor}"
    )
    return ev, new_state, hint


def run_pee_loop(scenario: DisruptionScenario, max_steps: int = 5) -> list[IterationTrace]:
    """Run PEE until PROCEED_TO_FINAL_OUTPUT or max_steps."""
    state = LoopState()
    traces: list[IterationTrace] = []

    for step in range(max_steps):
        planner = plan(scenario, state, step)
        action = execute(scenario, state, step)
        # Apply inventory tool when querying ERP
        if state.inventory is None:
            state.inventory = model_inventory_impact(scenario)
        ev, state, hint = evaluate(scenario, state, action, step)
        inv = state.inventory
        assert inv is not None

        doir = (
            inv.recovery_doir
            if state.contracts_loaded
            else inv.projected_doir_after_delay
        )
        verdict: Verdict = ev["verdict"]
        state_label = "RETRY_EVALUATION" if verdict == "RETRY" else verdict

        if step == 0:
            completed = "strike/disruption bulletin parsed; primary ERP pull attempted"
            remaining = "backup supplier contracts; alternate routing; mitigation memo"
            decisions = f"reroute=secondary_erp_shard; risk={scenario.severity}_doir"
        elif verdict == "CONTINUE":
            completed = "backup contracts + alt lane capacity retrieved"
            remaining = "emit executive mitigation report"
            decisions = (
                f"vendor={inv.backup_vendor}; lane={inv.alt_lane}; "
                f"doir_recovered={inv.recovery_doir}"
            )
        else:
            completed = "evidence + executive mitigation report"
            remaining = "none"
            decisions = (
                f"verdict=PROCEED_TO_FINAL_OUTPUT; action=reallocate_PO_to_{inv.backup_vendor}"
            )

        carry = _carryover(
            completed=completed,
            remaining=remaining,
            decisions=decisions,
            confidence=ev["confidence_score"],
            retry_count=state.retry_count,
            missing=state.missing_evidence,
            doir=doir,
            extra=f"hist_delay_days={scenario.delay_days:.1f}; scenario={scenario.scenario_id}",
        )

        traces.append(
            IterationTrace(
                iteration=step + 1,
                state=state_label,
                planner=planner,
                executor=action,
                evaluator=ev,
                metrics={
                    "meterless_tokens_used": 1100 + step * 360 + int(scenario.risk_score * 200),
                    "nvidia_nim_latency_ms": 45 + step * 6 + int(scenario.congestion * 20),
                    "doir_days": doir,
                    "burn_rate_units_per_day": inv.daily_burn,
                    "hist_delay_days": scenario.delay_days,
                    "hist_risk_score": scenario.risk_score,
                },
                carryover=carry,
                hint=hint,
                scenario_id=scenario.scenario_id,
                event_name=scenario.event_name,
            )
        )

        try:
            get_telemetry_client().track_iteration(
                scenario_id=scenario.scenario_id,
                iteration_num=step + 1,
                state=state_label,
                verdict=verdict,
                nim_latency_ms=45 + step * 6 + int(scenario.congestion * 20),
                tokens_used=1100 + step * 360 + int(scenario.risk_score * 200),
                doir_days=doir,
                confidence_score=float(ev.get("confidence_score", 0.0)),
            )
        except Exception:
            pass

        if verdict == "PROCEED_TO_FINAL_OUTPUT":
            break

    return traces
