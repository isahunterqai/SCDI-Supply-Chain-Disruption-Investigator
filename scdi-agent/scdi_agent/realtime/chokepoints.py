"""Definitions and metadata for global maritime chokepoints and primary port hubs."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass(frozen=True)
class ChokepointMeta:
    id: str
    name: str
    type: str  # "chokepoint" | "hub_port" | "canal"
    lat: float
    lon: float
    region: str
    centrality_weight: float  # 0.0 - 1.0 strategic global trade importance
    substitute_penalty: float  # 0.0 - 1.0 difficulty of alternative bypass (e.g. Cape of Good Hope)
    primary_routes: List[str]
    affected_ports: List[str]
    critical_commodities: List[str]
    normal_transit_days: float
    detour_transit_days: float


GLOBAL_CHOKEPOINTS: Dict[str, ChokepointMeta] = {
    "suez": ChokepointMeta(
        id="suez",
        name="Suez Canal / Red Sea Gateway",
        type="canal",
        lat=30.0,
        lon=32.5,
        region="Middle East / Red Sea",
        centrality_weight=0.96,
        substitute_penalty=0.94,
        primary_routes=["R-ASIA-EU", "R-ASIA-MED", "R-TRANS-SUEZ"],
        affected_ports=["Port Said", "Suez", "Jeddah", "Rotterdam", "Singapore"],
        critical_commodities=["Crude Oil & Refined Products", "Automotive", "Electronics", "Retail Goods"],
        normal_transit_days=1.5,
        detour_transit_days=14.0,  # Via Cape of Good Hope
    ),
    "malacca": ChokepointMeta(
        id="malacca",
        name="Strait of Malacca / Singapore",
        type="chokepoint",
        lat=1.4,
        lon=102.5,
        region="Southeast Asia",
        centrality_weight=0.98,
        substitute_penalty=0.90,
        primary_routes=["R-ASIA-EU", "R-PAC-USW", "R-ASIA-GULF", "R-SEASIA-US"],
        affected_ports=["Singapore", "Port Klang", "Tanjung Pelepas", "Shanghai", "Rotterdam"],
        critical_commodities=["Crude Oil", "Semiconductors", "Consumer Electronics", "Palm Oil"],
        normal_transit_days=1.2,
        detour_transit_days=5.5,  # Via Sunda or Lombok Strait
    ),
    "hormuz": ChokepointMeta(
        id="hormuz",
        name="Strait of Hormuz",
        type="chokepoint",
        lat=26.5,
        lon=56.25,
        region="Middle East / Persian Gulf",
        centrality_weight=0.97,
        substitute_penalty=0.98,  # Near-zero maritime bypass for Persian Gulf
        primary_routes=["R-GULF-ASIA", "R-GULF-EU", "R-GULF-US"],
        affected_ports=["Jebel Ali", "Dammam", "Ras Tanura", "Bandar Abbas", "Fujairah"],
        critical_commodities=["Crude Oil & Condensate", "LNG", "Petrochemical Feedstocks"],
        normal_transit_days=1.0,
        detour_transit_days=18.0,  # Pipeline limited
    ),
    "panama": ChokepointMeta(
        id="panama",
        name="Panama Canal",
        type="canal",
        lat=9.1,
        lon=-79.7,
        region="Central America",
        centrality_weight=0.91,
        substitute_penalty=0.89,
        primary_routes=["R-ASIA-USE", "R-PAC-USE", "R-LATAM-US"],
        affected_ports=["Balboa", "Colon", "Manzanillo", "Savannah", "Houston", "New York/New Jersey"],
        critical_commodities=["Grain & Agribulk", "LNG / LPG", "Automotive", "Manufactured Goods"],
        normal_transit_days=1.0,
        detour_transit_days=12.0,  # Via Cape Horn or US Intermodal Rail
    ),
    "taiwan_strait": ChokepointMeta(
        id="taiwan_strait",
        name="Taiwan Strait",
        type="chokepoint",
        lat=24.0,
        lon=119.5,
        region="East Asia",
        centrality_weight=0.93,
        substitute_penalty=0.82,
        primary_routes=["R-EASIA-PAC", "R-PAC-USW", "R-EASIA"],
        affected_ports=["Kaohsiung", "Keelung", "Xiamen", "Shanghai", "Long Beach"],
        critical_commodities=["Advanced Logic Semiconductors", "Display Panels", "Industrial Robotics"],
        normal_transit_days=1.2,
        detour_transit_days=4.5,  # Via eastern coast of Taiwan
    ),
    "shanghai": ChokepointMeta(
        id="shanghai",
        name="Shanghai / Ningbo-Zhoushan Cluster",
        type="hub_port",
        lat=31.23,
        lon=121.47,
        region="East Asia",
        centrality_weight=0.95,
        substitute_penalty=0.85,
        primary_routes=["R-PAC-USW", "R-ASIA-EU", "R-EASIA-PAC", "R-ASIA-USE"],
        affected_ports=["Shanghai", "Ningbo-Zhoushan", "Taicang"],
        critical_commodities=["Consumer Goods", "Solar Equipment", "EV Batteries", "Industrial Machinery"],
        normal_transit_days=2.0,
        detour_transit_days=6.0,
    ),
    "rotterdam": ChokepointMeta(
        id="rotterdam",
        name="Rotterdam / North Sea Gate",
        type="hub_port",
        lat=51.92,
        lon=4.48,
        region="Europe",
        centrality_weight=0.90,
        substitute_penalty=0.78,
        primary_routes=["R-ASIA-EU", "R-TRANSATL", "R-EUR-FEED", "R-EUR-INL"],
        affected_ports=["Rotterdam", "Antwerp", "Hamburg", "Duisburg"],
        critical_commodities=["Chemicals & Plastics", "Energy", "Machinery", "Automotive Parts"],
        normal_transit_days=2.0,
        detour_transit_days=4.0,
    ),
    "la_lb": ChokepointMeta(
        id="la_lb",
        name="San Pedro Bay (Los Angeles & Long Beach)",
        type="hub_port",
        lat=33.74,
        lon=-118.27,
        region="North America (West Coast)",
        centrality_weight=0.92,
        substitute_penalty=0.86,
        primary_routes=["R-PAC-USW", "R-EASIA-USW", "R-SEASIA-US"],
        affected_ports=["Los Angeles", "Long Beach", "Oakland", "Seattle"],
        critical_commodities=["Apparel & Footwear", "Electronics", "Furniture", "Vehicle Components"],
        normal_transit_days=3.0,
        detour_transit_days=7.0,  # Transshipment via PNW or Gulf
    ),
    "houston": ChokepointMeta(
        id="houston",
        name="Houston / US Gulf Coast Energy Hub",
        type="hub_port",
        lat=29.76,
        lon=-95.36,
        region="North America (Gulf Coast)",
        centrality_weight=0.88,
        substitute_penalty=0.84,
        primary_routes=["R-GULF-EU", "R-GULF-LATAM", "R-GULF-ASIA"],
        affected_ports=["Houston", "Corpus Christi", "New Orleans", "Galveston"],
        critical_commodities=["Petrochemical Resins", "Crude Exports", "Industrial Chemicals", "Steel"],
        normal_transit_days=2.5,
        detour_transit_days=8.0,
    ),
    "busan": ChokepointMeta(
        id="busan",
        name="Busan / Korea Strait Transshipment",
        type="hub_port",
        lat=35.10,
        lon=129.04,
        region="East Asia",
        centrality_weight=0.87,
        substitute_penalty=0.76,
        primary_routes=["R-PAC-USW", "R-EASIA", "R-ASIA-MED"],
        affected_ports=["Busan", "Gwangyang", "Incheon", "Fukuoka"],
        critical_commodities=["Memory Chips & Flash", "Automotive Electronics", "Shipbuilding Components"],
        normal_transit_days=1.5,
        detour_transit_days=4.0,
    ),
}
