"""Azure Application Insights Telemetry Integration for SCDI Agent Backend.

Zero third-party pip dependencies — uses Python standard library urllib.request.
"""
from __future__ import annotations

import json
import logging
import os
import re
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger("scdi_agent.telemetry")

DEFAULT_CONNECTION_STRING = (
    "InstrumentationKey=f30b4c6a-de1c-4d93-9947-9bd9acc8e2e3;"
    "IngestionEndpoint=https://eastus-8.in.applicationinsights.azure.com/;"
    "LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;"
    "ApplicationId=f7e07a9d-2908-4d76-b6d3-6dbb1b51c9e3"
)


class ApplicationInsightsClient:
    def __init__(self, connection_string: Optional[str] = None) -> None:
        raw = connection_string or os.environ.get("APPLICATIONINSIGHTS_CONNECTION_STRING") or DEFAULT_CONNECTION_STRING
        self.connection_string = raw

        # Parse InstrumentationKey
        key_match = re.search(r"InstrumentationKey=([^;]+)", raw)
        self.instrumentation_key = key_match.group(1) if key_match else "f30b4c6a-de1c-4d93-9947-9bd9acc8e2e3"

        # Parse IngestionEndpoint
        ep_match = re.search(r"IngestionEndpoint=([^;]+)", raw)
        base = ep_match.group(1).rstrip("/") if ep_match else "https://eastus-8.in.applicationinsights.azure.com"
        self.endpoint_url = f"{base}/v2/track"

    def _post_item(self, payload: Dict[str, Any]) -> bool:
        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self.endpoint_url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=3.0) as resp:
                return resp.status in (200, 206)
        except Exception as exc:
            logger.debug("Telemetry dispatch error: %s", exc)
            return False

    def track_event(
        self,
        name: str,
        properties: Optional[Dict[str, Any]] = None,
        measurements: Optional[Dict[str, float]] = None,
    ) -> bool:
        now_iso = datetime.now(timezone.utc).isoformat()
        props = properties or {}
        props.setdefault("service", "scdi-agent-python")

        payload = {
            "name": "Microsoft.ApplicationInsights.Event",
            "time": now_iso,
            "iKey": self.instrumentation_key,
            "data": {
                "baseType": "EventData",
                "baseData": {
                    "ver": 2,
                    "name": name,
                    "properties": {k: str(v) for k, v in props.items()},
                    "measurements": measurements or {},
                },
            },
        }
        return self._post_item(payload)

    def track_metric(
        self,
        name: str,
        value: float,
        properties: Optional[Dict[str, Any]] = None,
    ) -> bool:
        now_iso = datetime.now(timezone.utc).isoformat()
        props = properties or {}
        props.setdefault("service", "scdi-agent-python")

        payload = {
            "name": "Microsoft.ApplicationInsights.Metric",
            "time": now_iso,
            "iKey": self.instrumentation_key,
            "data": {
                "baseType": "MetricData",
                "baseData": {
                    "ver": 2,
                    "metrics": [
                        {
                            "name": name,
                            "value": float(value),
                            "count": 1,
                        }
                    ],
                    "properties": {k: str(v) for k, v in props.items()},
                },
            },
        }
        return self._post_item(payload)

    def track_iteration(
        self,
        scenario_id: str,
        iteration_num: int,
        state: str,
        verdict: str,
        nim_latency_ms: int,
        tokens_used: int,
        doir_days: float,
        confidence_score: float,
    ) -> bool:
        return self.track_event(
            name="Scdi_PEE_Iteration",
            properties={
                "scenario_id": scenario_id,
                "iteration": str(iteration_num),
                "state": state,
                "verdict": verdict,
            },
            measurements={
                "nvidia_nim_latency_ms": float(nim_latency_ms),
                "meterless_tokens_used": float(tokens_used),
                "doir_days": float(doir_days),
                "confidence_score": float(confidence_score),
            },
        )


_DEFAULT_CLIENT: Optional[ApplicationInsightsClient] = None


def get_telemetry_client() -> ApplicationInsightsClient:
    global _DEFAULT_CLIENT
    if _DEFAULT_CLIENT is None:
        _DEFAULT_CLIENT = ApplicationInsightsClient()
    return _DEFAULT_CLIENT
