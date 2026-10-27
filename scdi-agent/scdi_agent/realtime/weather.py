"""Real-time global marine and atmospheric weather feed using Open-Meteo APIs."""

from __future__ import annotations

import concurrent.futures
import json
import logging
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

from scdi_agent.realtime.chokepoints import GLOBAL_CHOKEPOINTS, ChokepointMeta

logger = logging.getLogger(__name__)

# WMO Weather code interpretations
WMO_CODES = {
    0: ("Clear sky", 0.0),
    1: ("Mainly clear", 0.05),
    2: ("Partly cloudy", 0.1),
    3: ("Overcast", 0.15),
    45: ("Dense fog / visibility restriction", 0.45),
    48: ("Depositing rime fog", 0.50),
    51: ("Light drizzle", 0.15),
    53: ("Moderate drizzle", 0.20),
    55: ("Dense drizzle", 0.30),
    61: ("Slight rain", 0.20),
    63: ("Moderate rain", 0.35),
    65: ("Heavy rain / berthing delay", 0.60),
    71: ("Slight snow", 0.30),
    73: ("Moderate snow", 0.50),
    75: ("Heavy snow / icy berths", 0.75),
    80: ("Rain showers", 0.30),
    81: ("Moderate rain showers", 0.45),
    82: ("Violent rain showers", 0.70),
    95: ("Thunderstorm", 0.65),
    96: ("Thunderstorm with slight hail", 0.80),
    99: ("Severe thunderstorm with heavy hail / gale", 0.95),
}


@dataclass
class WeatherObservation:
    chokepoint_id: str
    location_name: str
    region: str
    lat: float
    lon: float
    temperature_c: float
    wind_speed_kmh: float
    wind_gusts_kmh: float
    weather_code: int
    condition: str
    wave_height_m: float
    swell_height_m: float
    hazard_score: float  # 0.0 to 1.0
    alert_level: str  # "normal" | "advisory" | "warning" | "critical"
    alert_summary: str
    timestamp: str

    def to_dict(self) -> dict:
        return asdict(self)


def _fetch_single_weather(chokepoint: ChokepointMeta, timeout: float = 4.0) -> WeatherObservation:
    """Fetch atmospheric + marine conditions for a single chokepoint/port."""
    lat, lon = chokepoint.lat, chokepoint.lon
    
    # 1. Atmospheric forecast endpoint
    weather_url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat:.4f}&longitude={lon:.4f}&"
        f"current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m"
    )

    # 2. Marine forecast endpoint
    marine_url = (
        f"https://marine-api.open-meteo.com/v1/marine?"
        f"latitude={lat:.4f}&longitude={lon:.4f}&"
        f"current=wave_height,swell_wave_height"
    )

    temp_c = 22.0
    wind_speed = 15.0
    wind_gusts = 20.0
    weather_code = 0
    condition = "Clear sky"
    code_hazard = 0.0
    wave_height = 1.0
    swell_height = 0.8
    timestamp = ""

    req_headers = {"User-Agent": "SCDI-Agent-Investigator/2.0"}

    # Fetch weather
    try:
        req = urllib.request.Request(weather_url, headers=req_headers)
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            curr = data.get("current", {})
            temp_c = float(curr.get("temperature_2m", temp_c))
            wind_speed = float(curr.get("wind_speed_10m", wind_speed))
            wind_gusts = float(curr.get("wind_gusts_10m", wind_gusts))
            weather_code = int(curr.get("weather_code", weather_code))
            timestamp = str(curr.get("time", ""))
            if weather_code in WMO_CODES:
                condition, code_hazard = WMO_CODES[weather_code]
            else:
                condition = f"Code {weather_code}"
                code_hazard = 0.2
    except Exception as e:
        logger.debug("Open-Meteo weather fetch error for %s: %s", chokepoint.id, e)

    # Fetch marine waves
    try:
        req_m = urllib.request.Request(marine_url, headers=req_headers)
        with urllib.request.urlopen(req_m, timeout=timeout) as resp_m:
            data_m = json.loads(resp_m.read().decode("utf-8"))
            curr_m = data_m.get("current", {})
            if curr_m.get("wave_height") is not None:
                wave_height = float(curr_m.get("wave_height", 1.0))
            if curr_m.get("swell_wave_height") is not None:
                swell_height = float(curr_m.get("swell_wave_height", 0.8))
    except Exception as e:
        logger.debug("Open-Meteo marine fetch error for %s: %s", chokepoint.id, e)

    # Calculate composite weather hazard score (0.0 to 1.0)
    # Wind gust hazard: 30 km/h = 0.1, 60 km/h = 0.5, 90+ km/h = 1.0
    wind_hazard = min(1.0, max(0.0, (wind_gusts - 25.0) / 65.0))
    # Wave hazard: 1.5m = 0.1, 3.5m = 0.5, 6.0m+ = 1.0
    wave_hazard = min(1.0, max(0.0, (wave_height - 1.5) / 4.5))

    composite_hazard = min(1.0, 0.40 * wind_hazard + 0.35 * wave_hazard + 0.25 * code_hazard)

    if composite_hazard >= 0.70 or wind_gusts >= 80.0 or wave_height >= 4.5:
        alert_level = "critical"
        alert_summary = f"Severe Maritime Storm: Gusts {wind_gusts:.1f} km/h, Sea State {wave_height:.1f}m ({condition})"
    elif composite_hazard >= 0.45 or wind_gusts >= 55.0 or wave_height >= 3.0:
        alert_level = "warning"
        alert_summary = f"Gale Advisory: Gusts {wind_gusts:.1f} km/h, Wave Height {wave_height:.1f}m ({condition})"
    elif composite_hazard >= 0.25:
        alert_level = "advisory"
        alert_summary = f"Moderate Weather: Gusts {wind_gusts:.1f} km/h, Waves {wave_height:.1f}m ({condition})"
    else:
        alert_level = "normal"
        alert_summary = f"Fair Navigation: Wind {wind_speed:.1f} km/h, Sea State {wave_height:.1f}m"

    return WeatherObservation(
        chokepoint_id=chokepoint.id,
        location_name=chokepoint.name,
        region=chokepoint.region,
        lat=lat,
        lon=lon,
        temperature_c=temp_c,
        wind_speed_kmh=wind_speed,
        wind_gusts_kmh=wind_gusts,
        weather_code=weather_code,
        condition=condition,
        wave_height_m=wave_height,
        swell_height_m=swell_height,
        hazard_score=round(composite_hazard, 3),
        alert_level=alert_level,
        alert_summary=alert_summary,
        timestamp=timestamp,
    )


def fetch_all_chokepoints_weather(max_workers: int = 5) -> List[WeatherObservation]:
    """Concurrent fetch of all global maritime choke points and port clusters."""
    results: List[WeatherObservation] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {
            executor.submit(_fetch_single_weather, cp): cp.id
            for cp in GLOBAL_CHOKEPOINTS.values()
        }
        for future in concurrent.futures.as_completed(future_map):
            try:
                obs = future.result()
                results.append(obs)
            except Exception as e:
                logger.error("Error fetching weather for chokepoint: %s", e)

    # Sort descending by hazard score
    results.sort(key=lambda x: x.hazard_score, reverse=True)
    return results
