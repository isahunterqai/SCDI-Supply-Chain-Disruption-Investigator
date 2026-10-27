"""Real-time disruption service coordinator and simulation bridge."""

from __future__ import annotations

import logging
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from scdi_agent.export import traces_to_dashboard, write_dashboard_ts, write_json
from scdi_agent.loop.pee import IterationTrace, run_pee_loop
from scdi_agent.realtime.chokepoints import GLOBAL_CHOKEPOINTS
from scdi_agent.realtime.disaster import DisasterEvent, fetch_all_natural_disasters
from scdi_agent.realtime.geopolitical import GeopoliticalEvent, fetch_all_geopolitical_events
from scdi_agent.realtime.predictive_model import (
    PredictiveScdAssessment,
    assess_geopolitical_event,
    assess_natural_disaster,
    assess_weather_disruption,
)
from scdi_agent.realtime.weather import WeatherObservation, fetch_all_chokepoints_weather

logger = logging.getLogger(__name__)


class RealtimeDisruptionService:
    def __init__(self, cache_ttl_sec: float = 45.0):
        self.cache_ttl_sec = cache_ttl_sec
        self._last_refresh = 0.0
        self._cached_weather: List[WeatherObservation] = []
        self._cached_disasters: List[DisasterEvent] = []
        self._cached_geopolitical: List[GeopoliticalEvent] = []
        self._cached_assessments: List[PredictiveScdAssessment] = []

    def refresh(self, force: bool = False) -> None:
        """Fetch real-time data across all feeds and run predictive models."""
        now = time.time()
        if not force and (now - self._last_refresh < self.cache_ttl_sec) and self._cached_assessments:
            return

        logger.info("Refreshing real-time disruption data from weather, disasters, and geopolitical APIs...")

        # 1. Weather
        try:
            self._cached_weather = fetch_all_chokepoints_weather()
        except Exception as e:
            logger.error("Weather fetch failed: %s", e)

        # 2. Natural Disasters
        try:
            self._cached_disasters = fetch_all_natural_disasters()
        except Exception as e:
            logger.error("Disasters fetch failed: %s", e)

        # 3. Geopolitical
        try:
            self._cached_geopolitical = fetch_all_geopolitical_events()
        except Exception as e:
            logger.error("Geopolitical fetch failed: %s", e)

        # 4. Run Predictive Assessments
        assessments: List[PredictiveScdAssessment] = []

        # Weather assessments: prioritize locations with alert != normal or high gusts/waves
        for w in self._cached_weather:
            if w.hazard_score >= 0.20 or w.alert_level != "normal":
                assessments.append(assess_weather_disruption(w))

        # Natural disaster assessments: top 8 events
        for d in self._cached_disasters[:8]:
            assessments.append(assess_natural_disaster(d))

        # Geopolitical assessments: all filtered events
        for g in self._cached_geopolitical:
            assessments.append(assess_geopolitical_event(g))

        # Sort assessments: critical first, highest disruption score first
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        assessments.sort(
            key=lambda x: (
                severity_order.get(x.severity_rating, 4),
                -x.disruption_score,
                -x.disruption_likelihood,
            )
        )

        self._cached_assessments = assessments
        self._last_refresh = now

    def get_realtime_feed(self, force: bool = False) -> Dict[str, Any]:
        """Return the complete real-time disruption telemetry and predictive assessments."""
        self.refresh(force=force)

        # Chokepoints summary for radar
        chokepoint_radar = []
        for cp_id, cp in GLOBAL_CHOKEPOINTS.items():
            # Find matching weather
            w_match = next((w for w in self._cached_weather if w.chokepoint_id == cp_id), None)
            # Find highest assessment
            asm_match = next(
                (a for a in self._cached_assessments if a.source_event_id == cp_id or a.primary_chokepoint == cp.name),
                None,
            )
            chokepoint_radar.append(
                {
                    "id": cp.id,
                    "name": cp.name,
                    "region": cp.region,
                    "lat": cp.lat,
                    "lon": cp.lon,
                    "centrality": cp.centrality_weight,
                    "weather": w_match.to_dict() if w_match else None,
                    "current_status": asm_match.severity_rating if asm_match else (w_match.alert_level if w_match else "normal"),
                    "disruption_score": asm_match.disruption_score if asm_match else (w_match.hazard_score if w_match else 0.1),
                    "disruption_likelihood": asm_match.disruption_likelihood if asm_match else 0.15,
                }
            )

        return {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "counts": {
                "total_assessments": len(self._cached_assessments),
                "critical": sum(1 for a in self._cached_assessments if a.severity_rating == "critical"),
                "high": sum(1 for a in self._cached_assessments if a.severity_rating == "high"),
                "medium": sum(1 for a in self._cached_assessments if a.severity_rating == "medium"),
                "low": sum(1 for a in self._cached_assessments if a.severity_rating == "low"),
                "weather_monitors": len(self._cached_weather),
                "disaster_alerts": len(self._cached_disasters),
                "geopolitical_events": len(self._cached_geopolitical),
            },
            "chokepoints_radar": chokepoint_radar,
            "assessments": [a.to_dict() for a in self._cached_assessments],
            "raw_weather": [w.to_dict() for w in self._cached_weather],
            "raw_disasters": [d.to_dict() for d in self._cached_disasters[:12]],
            "raw_geopolitical": [g.to_dict() for g in self._cached_geopolitical[:10]],
        }

    def simulate_realtime_assessment(
        self,
        assessment_id: Optional[str] = None,
        export_ts_path: Optional[Path] = None,
        export_json_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """Simulate the autonomous PEE agent loop on a real-time disruption event."""
        self.refresh()
        if not self._cached_assessments:
            raise ValueError("No real-time assessments available to simulate.")

        target: Optional[PredictiveScdAssessment] = None
        if assessment_id:
            target = next(
                (a for a in self._cached_assessments if a.assessment_id == assessment_id or a.source_event_id == assessment_id),
                None,
            )

        if not target:
            # Fall back to highest severity assessment
            target = self._cached_assessments[0]

        # Convert to DisruptionScenario
        scenario = target.to_disruption_scenario()

        # Run PEE loop
        traces: List[IterationTrace] = run_pee_loop(scenario)

        # Traces to dashboard representation
        dashboard_traces = traces_to_dashboard(traces)

        # Export if paths given
        if export_ts_path:
            write_dashboard_ts(export_ts_path, traces, event_name=scenario.event_name)

        if export_json_path:
            write_json(
                export_json_path,
                {
                    "assessment": target.to_dict(),
                    "scenario": scenario.to_dict(),
                    "iterations": dashboard_traces,
                },
            )

        return {
            "success": True,
            "assessment": target.to_dict(),
            "scenario": scenario.to_dict(),
            "iterations": dashboard_traces,
            "final_verdict": traces[-1].evaluator["verdict"] if traces else "PROCEED_TO_FINAL_OUTPUT",
            "decision_hint": traces[-1].hint if traces else "Mitigation executed",
        }


# Global singleton instance
_GLOBAL_REALTIME_SERVICE: Optional[RealtimeDisruptionService] = None


def get_realtime_service() -> RealtimeDisruptionService:
    global _GLOBAL_REALTIME_SERVICE
    if _GLOBAL_REALTIME_SERVICE is None:
        _GLOBAL_REALTIME_SERVICE = RealtimeDisruptionService()
    return _GLOBAL_REALTIME_SERVICE
