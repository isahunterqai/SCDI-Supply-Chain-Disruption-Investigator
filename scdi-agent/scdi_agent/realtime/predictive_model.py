"""Predictive analysis model for real-time supply chain disruption (SCD) risk."""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from scdi_agent.ingest.loader import DisruptionScenario
from scdi_agent.realtime.chokepoints import GLOBAL_CHOKEPOINTS, ChokepointMeta
from scdi_agent.realtime.disaster import DisasterEvent
from scdi_agent.realtime.geopolitical import GeopoliticalEvent
from scdi_agent.realtime.weather import WeatherObservation


@dataclass
class CommodityVulnerability:
    commodity: str
    vulnerability_score: float  # 0.0 to 1.0
    impact_description: str


@dataclass
class PredictiveScdAssessment:
    assessment_id: str
    source_type: str  # "weather" | "natural_disaster" | "geopolitical"
    source_event_id: str
    event_title: str
    observed_at: str
    primary_chokepoint: str
    region: str
    affected_ports: List[str]
    affected_routes: List[str]

    # Core Predictive Metrics
    disruption_likelihood: float  # 0.00 to 1.00 (Probability)
    disruption_score: float  # 0.00 to 1.00 (Composite intensity)
    severity_rating: str  # "critical" | "high" | "medium" | "low"

    # Predictive SCD Impacts
    projected_delay_days: float
    normal_transit_days: float
    detour_transit_days: float
    projected_freight_surge_pct: float
    estimated_freight_cost_usd: float
    projected_wait_hours: float
    projected_backlog_teu: int
    vulnerable_commodities: List[CommodityVulnerability]

    # Model Vector Components
    hazard_intensity: float
    centrality_weight: float
    substitute_penalty: float

    # Tactical Mitigation Recommendation
    recommended_mitigation: str
    strategic_rationale: str

    def to_dict(self) -> dict:
        d = asdict(self)
        d["disruption_likelihood_pct"] = round(self.disruption_likelihood * 100.0, 1)
        return d

    def to_disruption_scenario(self) -> DisruptionScenario:
        """Convert this real-time assessment into a DisruptionScenario for the PEE loop."""
        return DisruptionScenario(
            scenario_id=f"rt_{self.assessment_id[:10]}",
            source_file=f"realtime_{self.source_type}.api",
            event_name=self.event_title,
            date=self.observed_at[:10],
            region=self.region,
            ports=self.affected_ports,
            severity=self.severity_rating,
            delay_days=self.projected_delay_days,
            risk_score=self.disruption_score,
            freight_cost=self.estimated_freight_cost_usd,
            congestion=round(min(1.0, self.projected_wait_hours / 120.0), 2),
            on_time_pct=round(max(15.0, 95.0 - self.disruption_score * 65.0), 1),
            event_type=f"live_{self.source_type}",
            raw={
                "likelihood": self.disruption_likelihood,
                "surge_pct": self.projected_freight_surge_pct,
                "mitigation": self.recommended_mitigation,
            },
        )


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, x))))


def assess_weather_disruption(obs: WeatherObservation) -> PredictiveScdAssessment:
    """Predictive analysis of maritime weather conditions."""
    cp = GLOBAL_CHOKEPOINTS.get(obs.chokepoint_id)
    centrality = cp.centrality_weight if cp else 0.85
    substitute = cp.substitute_penalty if cp else 0.80
    normal_days = cp.normal_transit_days if cp else 2.0
    detour_days = cp.detour_transit_days if cp else 7.0
    ports = cp.affected_ports if cp else [obs.location_name]
    routes = cp.primary_routes if cp else ["R-MARITIME-HUB"]
    commodities = cp.critical_commodities if cp else ["General Containerized Cargo"]

    # Hazard intensity from weather observation
    hazard = obs.hazard_score

    # Predictive formula
    logit = 3.6 * hazard + 1.8 * centrality + 1.2 * substitute - 3.4
    likelihood = round(_sigmoid(logit), 3)

    disruption_score = round(min(1.0, 0.48 * hazard + 0.32 * centrality + 0.20 * substitute), 3)

    if disruption_score >= 0.82 or likelihood >= 0.85:
        severity = "critical"
    elif disruption_score >= 0.65 or likelihood >= 0.68:
        severity = "high"
    elif disruption_score >= 0.40 or likelihood >= 0.40:
        severity = "medium"
    else:
        severity = "low"

    # Impacts
    added_delay = round(disruption_score * (detour_days - normal_days) * 0.75, 1)
    projected_delay = round(normal_days + added_delay, 1)

    surge_pct = round((disruption_score ** 1.3) * 95.0, 1)
    base_freight = 3600.0
    freight_usd = round(base_freight * (1.0 + surge_pct / 100.0), 0)

    wait_hours = round(12.0 + disruption_score * 84.0, 1)
    backlog_teu = int(disruption_score * 22000)

    vuln_list = [
        CommodityVulnerability(
            commodity=c,
            vulnerability_score=round(min(0.98, disruption_score + 0.05 * (i == 0)), 2),
            impact_description=f"Berthing and crane offloading delays at {ports[0]} due to {obs.condition.lower()}.",
        )
        for i, c in enumerate(commodities[:4])
    ]

    mitigation = (
        f"Activate heavy-weather routing protocol: hold vessel outside swell zone or "
        f"shift transshipment discharge to {ports[-1] if len(ports) > 1 else 'alternate regional terminal'}."
    )
    rationale = (
        f"Wind gusts at {obs.wind_gusts_kmh:.1f} km/h with {obs.wave_height_m:.1f}m sea state "
        f"threaten container crane operations and pilotage safe limits."
    )

    now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    return PredictiveScdAssessment(
        assessment_id=f"wth_{obs.chokepoint_id}_{hash(obs.alert_summary) & 0xffff:04x}",
        source_type="weather",
        source_event_id=obs.chokepoint_id,
        event_title=f"Maritime Weather Impact: {obs.location_name} ({obs.condition})",
        observed_at=obs.timestamp or now_iso,
        primary_chokepoint=obs.location_name,
        region=obs.region,
        affected_ports=ports,
        affected_routes=routes,
        disruption_likelihood=likelihood,
        disruption_score=disruption_score,
        severity_rating=severity,
        projected_delay_days=projected_delay,
        normal_transit_days=normal_days,
        detour_transit_days=detour_days,
        projected_freight_surge_pct=surge_pct,
        estimated_freight_cost_usd=freight_usd,
        projected_wait_hours=wait_hours,
        projected_backlog_teu=backlog_teu,
        vulnerable_commodities=vuln_list,
        hazard_intensity=hazard,
        centrality_weight=centrality,
        substitute_penalty=substitute,
        recommended_mitigation=mitigation,
        strategic_rationale=rationale,
    )


def assess_natural_disaster(ev: DisasterEvent) -> PredictiveScdAssessment:
    """Predictive analysis of natural disaster events (USGS / GDACS)."""
    # Proximity hazard calculation
    dist_km = ev.distance_to_chokepoint_km or 2500.0
    proximity_factor = max(0.05, 1.0 - (dist_km / 2500.0))

    if ev.disaster_type in ("tropical_cyclone", "tsunami"):
        type_weight = 1.0
    elif ev.disaster_type == "earthquake":
        mag = ev.magnitude or 5.0
        type_weight = min(1.0, max(0.2, (mag - 4.0) / 3.5))
    else:
        type_weight = 0.65

    hazard = round(min(1.0, type_weight * proximity_factor * (1.3 if ev.tsunami_flag else 1.0)), 3)

    cp_meta = None
    for cp in GLOBAL_CHOKEPOINTS.values():
        if cp.name == ev.nearest_chokepoint or ev.nearest_port in cp.affected_ports:
            cp_meta = cp
            break

    centrality = cp_meta.centrality_weight if cp_meta else 0.82
    substitute = cp_meta.substitute_penalty if cp_meta else 0.78
    normal_days = cp_meta.normal_transit_days if cp_meta else 2.0
    detour_days = cp_meta.detour_transit_days if cp_meta else 9.0
    ports = cp_meta.affected_ports if cp_meta else ([ev.nearest_port] if ev.nearest_port else ["Regional Hub"])
    routes = ev.affected_routes if ev.affected_routes else ["R-REGIONAL-FEED"]
    commodities = cp_meta.critical_commodities if cp_meta else ["High-Tech Components", "Industrial Machinery"]

    logit = 4.0 * hazard + 1.8 * centrality + 1.1 * substitute - 3.2
    likelihood = round(_sigmoid(logit), 3)

    disruption_score = round(min(1.0, 0.50 * hazard + 0.30 * centrality + 0.20 * substitute), 3)

    if disruption_score >= 0.80 or ev.severity_label == "critical" or ev.tsunami_flag:
        severity = "critical"
    elif disruption_score >= 0.62 or ev.severity_label == "high":
        severity = "high"
    elif disruption_score >= 0.38:
        severity = "medium"
    else:
        severity = "low"

    added_delay = round(disruption_score * (detour_days - normal_days) * 0.9, 1)
    projected_delay = round(normal_days + added_delay, 1)

    surge_pct = round((disruption_score ** 1.35) * 115.0, 1)
    freight_usd = round(3800.0 * (1.0 + surge_pct / 100.0), 0)

    wait_hours = round(16.0 + disruption_score * 110.0, 1)
    backlog_teu = int(disruption_score * 31000)

    vuln_list = [
        CommodityVulnerability(
            commodity=c,
            vulnerability_score=round(min(0.99, disruption_score + 0.04), 2),
            impact_description=f"Physical port terminal disruption and vessel queue backlog triggered by {ev.disaster_type}.",
        )
        for c in commodities[:4]
    ]

    mitigation = (
        f"Execute emergency disaster reroute: divert inbound vessel calls to {ports[-1] if len(ports) > 1 else 'standby secondary berth'} "
        f"and invoke force majeure / dynamic supplier PO split."
    )
    rationale = (
        f"{ev.title} located {dist_km:.0f}km from {ev.nearest_chokepoint or 'maritime lane'} "
        f"raises severe navigational infrastructure and quay crane disruption risk."
    )

    return PredictiveScdAssessment(
        assessment_id=f"dis_{ev.event_id}",
        source_type="natural_disaster",
        source_event_id=ev.event_id,
        event_title=ev.title,
        observed_at=ev.timestamp,
        primary_chokepoint=ev.nearest_chokepoint or "Maritime Corridor",
        region=cp_meta.region if cp_meta else "Global Oceanic",
        affected_ports=ports,
        affected_routes=routes,
        disruption_likelihood=likelihood,
        disruption_score=disruption_score,
        severity_rating=severity,
        projected_delay_days=projected_delay,
        normal_transit_days=normal_days,
        detour_transit_days=detour_days,
        projected_freight_surge_pct=surge_pct,
        estimated_freight_cost_usd=freight_usd,
        projected_wait_hours=wait_hours,
        projected_backlog_teu=backlog_teu,
        vulnerable_commodities=vuln_list,
        hazard_intensity=hazard,
        centrality_weight=centrality,
        substitute_penalty=substitute,
        recommended_mitigation=mitigation,
        strategic_rationale=rationale,
    )


def assess_geopolitical_event(ev: GeopoliticalEvent) -> PredictiveScdAssessment:
    """Predictive analysis of geopolitical, conflict, and port strike events."""
    cp = GLOBAL_CHOKEPOINTS.get(ev.chokepoint_id or "")
    centrality = cp.centrality_weight if cp else 0.90
    substitute = cp.substitute_penalty if cp else 0.88
    normal_days = cp.normal_transit_days if cp else 1.5
    detour_days = cp.detour_transit_days if cp else 14.0
    ports = ev.affected_ports or (cp.affected_ports if cp else ["Strategic Hub"])
    routes = ev.affected_routes or (cp.primary_routes if cp else ["R-GLOBAL-TRANSIT"])
    commodities = ev.critical_commodities or (cp.critical_commodities if cp else ["Strategic Cargo"])

    hazard = ev.risk_score

    logit = 3.8 * hazard + 2.2 * centrality + 1.4 * substitute - 3.2
    likelihood = round(_sigmoid(logit), 3)

    disruption_score = round(min(1.0, 0.45 * hazard + 0.35 * centrality + 0.20 * substitute), 3)

    if disruption_score >= 0.80 or ev.severity == "critical":
        severity = "critical"
    elif disruption_score >= 0.65 or ev.severity == "high":
        severity = "high"
    elif disruption_score >= 0.40:
        severity = "medium"
    else:
        severity = "low"

    added_delay = round(disruption_score * (detour_days - normal_days), 1)
    projected_delay = round(normal_days + added_delay, 1)

    surge_pct = round((disruption_score ** 1.4) * 145.0, 1)
    freight_usd = round(4200.0 * (1.0 + surge_pct / 100.0), 0)

    wait_hours = round(20.0 + disruption_score * 130.0, 1)
    backlog_teu = int(disruption_score * 38000)

    vuln_list = [
        CommodityVulnerability(
            commodity=c,
            vulnerability_score=round(min(0.99, disruption_score + 0.03 * (i == 0)), 2),
            impact_description=f"Transit risk across {ev.chokepoint_name or ev.region} due to {ev.category.replace('_', ' ')}.",
        )
        for i, c in enumerate(commodities[:4])
    ]

    mitigation = (
        f"Execute strategic chokepoint diversion: reroute vessel strings around {ev.chokepoint_name or 'the conflict zone'}, "
        f"procure war risk insurance endorsements, and allocate safety stock across regional inland depots."
    )
    rationale = (
        f"{ev.headline}: Threat to vessel navigation corridor and port operations imposes "
        f"unacceptable security exposure, mandating autonomous detour planning."
    )

    return PredictiveScdAssessment(
        assessment_id=f"geo_{ev.event_id}",
        source_type="geopolitical",
        source_event_id=ev.event_id,
        event_title=ev.headline,
        observed_at=ev.timestamp,
        primary_chokepoint=ev.chokepoint_name or ev.region,
        region=ev.region,
        affected_ports=ports,
        affected_routes=routes,
        disruption_likelihood=likelihood,
        disruption_score=disruption_score,
        severity_rating=severity,
        projected_delay_days=projected_delay,
        normal_transit_days=normal_days,
        detour_transit_days=detour_days,
        projected_freight_surge_pct=surge_pct,
        estimated_freight_cost_usd=freight_usd,
        projected_wait_hours=wait_hours,
        projected_backlog_teu=backlog_teu,
        vulnerable_commodities=vuln_list,
        hazard_intensity=hazard,
        centrality_weight=centrality,
        substitute_penalty=substitute,
        recommended_mitigation=mitigation,
        strategic_rationale=rationale,
    )
