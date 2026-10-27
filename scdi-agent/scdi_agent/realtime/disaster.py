"""Real-time natural disaster feeds from USGS Earthquakes and GDACS (Global Disaster Alert)."""

from __future__ import annotations

import json
import logging
import math
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from scdi_agent.realtime.chokepoints import GLOBAL_CHOKEPOINTS, ChokepointMeta

logger = logging.getLogger(__name__)


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance in km between two points."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return r * c


def find_nearest_chokepoints(
    lat: float, lon: float, max_radius_km: float = 2500.0
) -> List[Tuple[ChokepointMeta, float]]:
    """Return chokepoints within max_radius_km sorted by proximity."""
    matches = []
    for cp in GLOBAL_CHOKEPOINTS.values():
        dist = haversine_km(lat, lon, cp.lat, cp.lon)
        if dist <= max_radius_km:
            matches.append((cp, dist))
    matches.sort(key=lambda x: x[1])
    return matches


@dataclass
class DisasterEvent:
    event_id: str
    source: str  # "USGS" | "GDACS"
    disaster_type: str  # "earthquake" | "tropical_cyclone" | "flood" | "volcano" | "tsunami"
    title: str
    severity_label: str  # "critical" | "high" | "medium" | "low"
    magnitude: Optional[float]
    depth_km: Optional[float]
    tsunami_flag: bool
    lat: float
    lon: float
    nearest_chokepoint: Optional[str]
    nearest_port: Optional[str]
    distance_to_chokepoint_km: Optional[float]
    affected_routes: List[str]
    impact_radius_km: float
    raw_alert_level: str  # "Red" | "Orange" | "Green" | "M4.5+"
    summary: str
    timestamp: str

    def to_dict(self) -> dict:
        return asdict(self)


def fetch_usgs_earthquakes(min_magnitude: float = 4.2, timeout: float = 5.0) -> List[DisasterEvent]:
    """Fetch recent earthquakes from USGS API and evaluate maritime proximity."""
    url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
    events: List[DisasterEvent] = []

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SCDI-Agent-Investigator/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        features = data.get("features", [])
        for feat in features:
            props = feat.get("properties", {})
            geom = feat.get("geometry", {})
            coords = geom.get("coordinates", [0, 0, 0])
            lon, lat = float(coords[0]), float(coords[1])
            depth = float(coords[2]) if len(coords) > 2 else 10.0
            mag = float(props.get("mag") or 0.0)
            if mag < min_magnitude:
                continue

            title = props.get("title", f"M {mag:.1f} Earthquake")
            tsunami = int(props.get("tsunami") or 0) == 1
            time_ms = props.get("time", 0)
            dt = datetime.fromtimestamp(time_ms / 1000.0, tz=timezone.utc)
            iso_time = dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            event_id = f"usgs_{feat.get('id', str(time_ms))}"

            nearby = find_nearest_chokepoints(lat, lon, max_radius_km=3000.0)
            nearest_cp = nearby[0][0].name if nearby else None
            nearest_port = nearby[0][0].affected_ports[0] if nearby else None
            dist_km = nearby[0][1] if nearby else None
            affected_routes = nearby[0][0].primary_routes if nearby else []

            # Determine severity
            if (mag >= 7.0 and dist_km and dist_km < 1200) or tsunami:
                severity = "critical"
            elif mag >= 6.0 and dist_km and dist_km < 1500:
                severity = "high"
            elif mag >= 5.0 and dist_km and dist_km < 1000:
                severity = "medium"
            else:
                severity = "low"

            summary = f"M {mag:.1f} seismic event at depth {depth:.1f}km."
            if nearest_cp and dist_km:
                summary += f" Located {dist_km:.0f}km from {nearest_cp}."
            if tsunami:
                summary += " TSUNAMI WARNING ACTIVE."

            events.append(
                DisasterEvent(
                    event_id=event_id,
                    source="USGS",
                    disaster_type="tsunami" if tsunami else "earthquake",
                    title=title,
                    severity_label=severity,
                    magnitude=mag,
                    depth_km=depth,
                    tsunami_flag=tsunami,
                    lat=lat,
                    lon=lon,
                    nearest_chokepoint=nearest_cp,
                    nearest_port=nearest_port,
                    distance_to_chokepoint_km=round(dist_km, 1) if dist_km else None,
                    affected_routes=affected_routes,
                    impact_radius_km=round(mag * 120.0, 1),
                    raw_alert_level=f"M{mag:.1f}",
                    summary=summary,
                    timestamp=iso_time,
                )
            )
    except Exception as e:
        logger.error("Failed to fetch USGS earthquakes: %s", e)

    return events


def fetch_gdacs_alerts(timeout: float = 6.0) -> List[DisasterEvent]:
    """Fetch global disaster alerts from GDACS RSS feed (Tropical Cyclones, Floods, Earthquakes)."""
    url = "https://www.gdacs.org/xml/rss.xml"
    events: List[DisasterEvent] = []

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SCDI-Agent-Investigator/2.0"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw_xml = resp.read()

        root = ET.fromstring(raw_xml)
        namespaces = {
            "gdacs": "http://www.gdacs.org",
            "geo": "http://www.w3.org/2003/01/geo/wgs84_pos#",
            "georss": "http://www.georss.org/georss",
        }

        channel = root.find("channel")
        if channel is None:
            return []

        for item in channel.findall("item"):
            title_elem = item.find("title")
            title = title_elem.text if title_elem is not None and title_elem.text else "GDACS Alert"

            desc_elem = item.find("description")
            desc = desc_elem.text if desc_elem is not None and desc_elem.text else ""

            pubdate_elem = item.find("pubDate")
            pubdate = pubdate_elem.text if pubdate_elem is not None and pubdate_elem.text else ""

            # Coordinates
            lat = 0.0
            lon = 0.0
            geo_point = item.find("georss:point", namespaces)
            if geo_point is not None and geo_point.text:
                parts = geo_point.text.strip().split()
                if len(parts) == 2:
                    lat, lon = float(parts[0]), float(parts[1])
            else:
                lat_elem = item.find("geo:lat", namespaces)
                lon_elem = item.find("geo:long", namespaces)
                if lat_elem is not None and lon_elem is not None and lat_elem.text and lon_elem.text:
                    lat, lon = float(lat_elem.text), float(lon_elem.text)

            # Alert level
            alert_elem = item.find("gdacs:alertlevel", namespaces)
            raw_alert = alert_elem.text if alert_elem is not None and alert_elem.text else "Green"

            # Event type
            ev_type_elem = item.find("gdacs:eventtype", namespaces)
            ev_code = ev_type_elem.text.upper() if ev_type_elem is not None and ev_type_elem.text else "EQ"
            type_mapping = {
                "TC": "tropical_cyclone",
                "FL": "flood",
                "EQ": "earthquake",
                "VO": "volcano",
                "TS": "tsunami",
                "DR": "drought",
            }
            disaster_type = type_mapping.get(ev_code, "natural_disaster")

            # Unique event id
            ev_id_elem = item.find("gdacs:eventid", namespaces)
            ev_id = f"gdacs_{ev_code}_{ev_id_elem.text}" if ev_id_elem is not None and ev_id_elem.text else f"gdacs_{hash(title)}"

            # Proximity to maritime trade chokepoints
            nearby = find_nearest_chokepoints(lat, lon, max_radius_km=3000.0)
            nearest_cp = nearby[0][0].name if nearby else None
            nearest_port = nearby[0][0].affected_ports[0] if nearby else None
            dist_km = nearby[0][1] if nearby else None
            affected_routes = nearby[0][0].primary_routes if nearby else []

            # Map GDACS alert level to severity
            if raw_alert.lower() == "red":
                severity = "critical"
            elif raw_alert.lower() == "orange":
                severity = "high"
            elif raw_alert.lower() == "yellow":
                severity = "medium"
            else:
                severity = "low"

            # Escalate if tropical cyclone or flood is close to a primary chokepoint
            if disaster_type in ("tropical_cyclone", "tsunami") and dist_km and dist_km < 800:
                if severity in ("medium", "high"):
                    severity = "critical"

            summary = desc if desc else title
            if nearest_cp and dist_km:
                summary += f" [Proximity: {dist_km:.0f}km to {nearest_cp}]"

            events.append(
                DisasterEvent(
                    event_id=ev_id,
                    source="GDACS",
                    disaster_type=disaster_type,
                    title=title,
                    severity_label=severity,
                    magnitude=None,
                    depth_km=None,
                    tsunami_flag=disaster_type == "tsunami",
                    lat=lat,
                    lon=lon,
                    nearest_chokepoint=nearest_cp,
                    nearest_port=nearest_port,
                    distance_to_chokepoint_km=round(dist_km, 1) if dist_km else None,
                    affected_routes=affected_routes,
                    impact_radius_km=500.0 if disaster_type == "tropical_cyclone" else 200.0,
                    raw_alert_level=raw_alert,
                    summary=summary,
                    timestamp=pubdate,
                )
            )
    except Exception as e:
        logger.error("Failed to fetch GDACS alerts: %s", e)

    return events


def fetch_all_natural_disasters() -> List[DisasterEvent]:
    """Fetch combined natural disaster feed from USGS and GDACS."""
    usgs = fetch_usgs_earthquakes(min_magnitude=4.5)
    gdacs = fetch_gdacs_alerts()
    combined = usgs + gdacs
    # Sort: critical, high, medium, low
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    combined.sort(key=lambda x: severity_order.get(x.severity_label, 4))
    return combined
