"""Deterministic inventory / DOIR modeling from historical disruption signals."""

from __future__ import annotations

from dataclasses import dataclass

from scdi_agent.ingest.loader import DisruptionScenario


@dataclass
class InventorySnapshot:
    sku: str
    warehouse: str
    on_hand: float
    daily_burn: float
    doir_days: float
    projected_doir_after_delay: float
    backup_vendor: str | None
    alt_lane: str | None
    recovery_doir: float


# Simple SKU exposure map keyed by primary port / region keywords
_SKU_EXPOSURE = [
    ("Los Angeles", "SKU-LAX-ELECTRONICS", "US-West-DC-01", 3600, 860, "V-482", "rail_intermodal"),
    ("Long Beach", "SKU-LGB-APPAREL", "US-West-DC-02", 2800, 720, "V-119", "air_freight_partial"),
    ("Shanghai", "SKU-SHA-COMPONENTS", "APAC-Hub-01", 5200, 940, "V-330", "transpac_alt"),
    ("Busan", "SKU-PUS-AUTO", "APAC-Hub-02", 4100, 800, "V-221", "rail_eurasia"),
    ("Rotterdam", "SKU-RTM-CHEM", "EU-West-DC-01", 2400, 510, "V-088", "north_sea_shortsea"),
    ("Jebel Ali", "SKU-JEA-ENERGY", "ME-Hub-01", 1900, 430, "V-701", "cape_of_good_hope"),
    ("Jeddah", "SKU-JED-FOOD", "ME-Hub-02", 1500, 380, "V-655", "landbridge_saudi"),
    ("Port Said", "SKU-PSD-GENERAL", "ME-Transit-01", 2100, 450, "V-402", "mediterranean_relay"),
    ("Odessa", "SKU-ODS-GRAIN", "EU-East-DC-01", 3300, 610, "V-512", "danube_barge"),
    ("Houston", "SKU-HOU-PETRO", "US-Gulf-DC-01", 2700, 580, "V-300", "gulf_coast_barge"),
]


def _match_exposure(scenario: DisruptionScenario) -> tuple:
    ports_l = " ".join(scenario.ports).lower()
    region_l = scenario.region.lower()
    for port, *rest in _SKU_EXPOSURE:
        if port.lower() in ports_l or port.lower() in region_l:
            return (port, *rest)
    # fallback
    return ("Unknown", "SKU-GEN-MIX", "Global-DC-00", 3000, 700, "V-100", "alt_ocean")


def model_inventory_impact(scenario: DisruptionScenario) -> InventorySnapshot:
    _, sku, wh, on_hand, burn, vendor, lane = _match_exposure(scenario)
    doir = on_hand / burn if burn else 0.0
    # Delay burns inventory; congestion amplifies effective delay
    effective_delay = scenario.delay_days * (1.0 + 0.35 * scenario.congestion)
    projected = max(0.0, doir - effective_delay)
    # Backup vendor recovers a share of risk based on severity
    recovery_boost = {"critical": 7.5, "high": 6.0, "medium": 4.5, "low": 3.0}.get(
        scenario.severity, 5.0
    )
    recovery = projected + recovery_boost * (1.0 - min(0.4, scenario.risk_score * 0.3))
    return InventorySnapshot(
        sku=sku,
        warehouse=wh,
        on_hand=on_hand,
        daily_burn=burn,
        doir_days=round(doir, 2),
        projected_doir_after_delay=round(projected, 2),
        backup_vendor=vendor,
        alt_lane=lane,
        recovery_doir=round(recovery, 2),
    )
