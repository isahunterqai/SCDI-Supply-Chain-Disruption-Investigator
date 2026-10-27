"""Ingest Kaggle-shaped supply-chain disruption CSVs into simulation scenarios."""

from __future__ import annotations

import csv
import hashlib
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Iterable


KNOWN_FILES = {
    "geopolitical_events.csv": "events",
    "weekly_route_operations.csv": "routes",
    "shipping_disruptions.csv": "ports",
}


@dataclass
class DisruptionScenario:
    """Normalized historical disruption used to drive one PEE simulation."""

    scenario_id: str
    source_file: str
    event_name: str
    date: str
    region: str
    ports: list[str]
    severity: str
    delay_days: float
    risk_score: float
    freight_cost: float
    congestion: float
    on_time_pct: float | None = None
    event_type: str = "disruption"
    raw: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _norm_key(key: str) -> str:
    return "".join(ch for ch in key.lower().strip() if ch.isalnum() or ch == "_")


def _get(row: dict[str, str], *aliases: str, default: str = "") -> str:
    normalized = {_norm_key(k): v for k, v in row.items()}
    for alias in aliases:
        val = normalized.get(_norm_key(alias))
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    return default


def _float(row: dict[str, str], *aliases: str, default: float = 0.0) -> float:
    raw = _get(row, *aliases, default="")
    if raw == "":
        return default
    try:
        return float(raw.replace(",", "").replace("%", ""))
    except ValueError:
        return default


def _severity_from_score(score: float) -> str:
    if score >= 0.85 or score >= 8.5:
        return "critical"
    if score >= 0.7 or score >= 7.0:
        return "high"
    if score >= 0.5 or score >= 5.0:
        return "medium"
    return "low"


def _sid(*parts: str) -> str:
    digest = hashlib.sha1("|".join(parts).encode()).hexdigest()[:10]
    return f"scn_{digest}"


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as fh:
        return list(csv.DictReader(fh))


def discover_datasets(data_dir: Path) -> dict[str, Path]:
    """Find known Kaggle CSV names under data_dir (and one-level subdirs)."""
    found: dict[str, Path] = {}
    roots = [data_dir]
    if data_dir.is_dir():
        roots.extend(p for p in data_dir.iterdir() if p.is_dir())

    for root in roots:
        for name, kind in KNOWN_FILES.items():
            candidate = root / name
            if candidate.is_file() and kind not in found:
                found[kind] = candidate
    return found


def _from_events(path: Path) -> Iterable[DisruptionScenario]:
    for row in _read_csv(path):
        score = _float(row, "disruption_score", "severity_score", "severity", default=0.7)
        # if severity is a label, keep numeric score separate
        severity_label = _get(row, "severity", default="")
        if severity_label.lower() in {"critical", "high", "medium", "low"}:
            severity = severity_label.lower()
        else:
            severity = _severity_from_score(score)
        ports_raw = _get(row, "affected_ports", "ports", "port", default="")
        ports = [p.strip() for p in ports_raw.split(",") if p.strip()]
        name = _get(row, "event_name", "event", "name", default="Unknown event")
        date = _get(row, "start_date", "date", default="")
        region = _get(row, "region", default="Global")
        yield DisruptionScenario(
            scenario_id=_sid("event", name, date),
            source_file=path.name,
            event_name=name,
            date=date,
            region=region,
            ports=ports or ["Unknown"],
            severity=severity,
            delay_days=max(3.0, score * 20.0 if score <= 1 else score * 2.0),
            risk_score=score if score <= 1 else min(1.0, score / 10.0),
            freight_cost=2500 + (score if score <= 1 else score / 10) * 4000,
            congestion=score if score <= 1 else min(1.0, score / 10.0),
            event_type=_get(row, "event_type", "type", default="geopolitical"),
            raw=dict(row),
        )


def _from_routes(path: Path) -> Iterable[DisruptionScenario]:
    for row in _read_csv(path):
        delay = _float(row, "delay_days", "delay", default=0.0)
        risk = _float(row, "risk_score", "risk", default=0.0)
        status = _get(row, "route_status", "status", default="").lower()
        if delay < 5 and risk < 0.55 and status not in {"disrupted", "suspended", "rerouted"}:
            continue
        origin = _get(row, "origin_port", "origin", default="?")
        dest = _get(row, "dest_port", "destination", "dest", default="?")
        date = _get(row, "date", "week", default="")
        route = _get(row, "route_id", "route", default=f"{origin}->{dest}")
        name = f"Route stress {route}: {origin} → {dest}"
        yield DisruptionScenario(
            scenario_id=_sid("route", route, date, origin, dest),
            source_file=path.name,
            event_name=name,
            date=date,
            region=_get(row, "region", default="Trade lane"),
            ports=[p for p in [origin, dest] if p and p != "?"],
            severity=_severity_from_score(risk if risk else delay / 25.0),
            delay_days=delay,
            risk_score=risk if risk else min(1.0, delay / 25.0),
            freight_cost=_float(row, "freight_cost_usd", "freight_cost", "freight_rate", default=3000),
            congestion=_float(row, "port_congestion", "congestion", default=risk),
            event_type=status or "route_disruption",
            raw=dict(row),
        )


def _from_ports(path: Path) -> Iterable[DisruptionScenario]:
    for row in _read_csv(path):
        idx = _float(row, "disruption_index", "disruption", "index", default=0.0)
        wait = _float(row, "wait_hours", "wait", default=0.0)
        if idx < 6.0 and wait < 48:
            continue
        port = _get(row, "port", default="Unknown port")
        date = _get(row, "date", default="")
        region = _get(row, "region", default="Unknown")
        on_time = _float(row, "on_time_pct", "on_time", default=50.0)
        name = f"Port disruption at {port}"
        risk = min(1.0, idx / 10.0 if idx else wait / 120.0)
        yield DisruptionScenario(
            scenario_id=_sid("port", port, date),
            source_file=path.name,
            event_name=name,
            date=date,
            region=region,
            ports=[port],
            severity=_severity_from_score(idx if idx else risk),
            delay_days=max(1.0, wait / 24.0),
            risk_score=risk,
            freight_cost=_float(row, "freight_rate", "freight_cost", default=2500),
            congestion=min(1.0, wait / 120.0),
            on_time_pct=on_time,
            event_type=_get(row, "vessel_type", default="port_disruption"),
            raw=dict(row),
        )


def load_scenarios(
    data_dir: Path,
    *,
    limit: int | None = None,
    prefer: tuple[str, ...] = ("events", "routes", "ports"),
) -> list[DisruptionScenario]:
    """Load and merge scenarios from discovered Kaggle files under data_dir."""
    data_dir = Path(data_dir)
    found = discover_datasets(data_dir)
    if not found:
        raise FileNotFoundError(
            f"No Kaggle disruption CSVs found under {data_dir}. "
            f"Expected one of: {', '.join(KNOWN_FILES)}"
        )

    scenarios: list[DisruptionScenario] = []
    loaders = {
        "events": _from_events,
        "routes": _from_routes,
        "ports": _from_ports,
    }
    for kind in prefer:
        path = found.get(kind)
        if not path:
            continue
        scenarios.extend(loaders[kind](path))

    # Deduplicate by scenario_id, keep first (events preferred via order)
    seen: set[str] = set()
    unique: list[DisruptionScenario] = []
    for scn in scenarios:
        if scn.scenario_id in seen:
            continue
        seen.add(scn.scenario_id)
        unique.append(scn)

    unique.sort(key=lambda s: (s.date, -s.risk_score))
    if limit is not None:
        unique = unique[:limit]
    return unique
