"""Tests for real-time disruption feeds and predictive analysis."""

import unittest
from scdi_agent.realtime.chokepoints import GLOBAL_CHOKEPOINTS
from scdi_agent.realtime.predictive_model import (
    assess_geopolitical_event,
    assess_natural_disaster,
    assess_weather_disruption,
)
from scdi_agent.realtime.weather import WeatherObservation
from scdi_agent.realtime.disaster import DisasterEvent
from scdi_agent.realtime.geopolitical import GeopoliticalEvent
from scdi_agent.loop.pee import run_pee_loop


class TestRealtimePredictiveModel(unittest.TestCase):
    def test_weather_assessment(self):
        obs = WeatherObservation(
            chokepoint_id="suez",
            location_name="Suez Canal / Red Sea Gateway",
            region="Middle East",
            lat=30.0,
            lon=32.5,
            temperature_c=25.0,
            wind_speed_kmh=45.0,
            wind_gusts_kmh=75.0,
            weather_code=95,
            condition="Thunderstorm",
            wave_height_m=3.5,
            swell_height_m=2.0,
            hazard_score=0.75,
            alert_level="warning",
            alert_summary="Severe Gale",
            timestamp="2026-10-26T23:00:00Z",
        )
        assessment = assess_weather_disruption(obs)
        self.assertGreater(assessment.disruption_likelihood, 0.70)
        self.assertGreater(assessment.disruption_score, 0.60)
        self.assertIn(assessment.severity_rating, ["high", "critical"])
        self.assertGreater(assessment.projected_delay_days, 1.5)
        self.assertGreater(assessment.projected_freight_surge_pct, 20.0)

        # Verify convertibility to scenario and PEE loop run
        scenario = assessment.to_disruption_scenario()
        self.assertEqual(scenario.severity, assessment.severity_rating)
        traces = run_pee_loop(scenario)
        self.assertGreater(len(traces), 0)
        self.assertEqual(traces[-1].evaluator["verdict"], "PROCEED_TO_FINAL_OUTPUT")

    def test_geopolitical_assessment(self):
        geo = GeopoliticalEvent(
            event_id="test_geo_1",
            headline="Strait of Hormuz Tanker Security Incident",
            source="Maritime Wire",
            severity="critical",
            category="conflict",
            chokepoint_id="hormuz",
            chokepoint_name="Strait of Hormuz",
            region="Middle East",
            affected_ports=["Jebel Ali", "Dammam"],
            affected_routes=["R-GULF-ASIA"],
            critical_commodities=["Crude Oil", "LNG"],
            risk_score=0.95,
            summary="Hostile drone patrol harassment reported.",
            link="https://example.com",
            timestamp="2026-10-26T20:00:00Z",
        )
        assessment = assess_geopolitical_event(geo)
        self.assertEqual(assessment.severity_rating, "critical")
        self.assertGreater(assessment.disruption_likelihood, 0.90)
        self.assertGreater(assessment.projected_delay_days, 10.0)
        self.assertGreater(len(assessment.vulnerable_commodities), 0)

        scenario = assessment.to_disruption_scenario()
        traces = run_pee_loop(scenario)
        self.assertGreater(len(traces), 0)
        self.assertIn("Mitigation accepted", traces[-1].hint)


if __name__ == "__main__":
    unittest.main()
