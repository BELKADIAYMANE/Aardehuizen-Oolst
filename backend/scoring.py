"""
scoring.py

Core scoring logic for Buurstroom.

Pipeline: cleaned CSVs (data/cleaned/, produced by clean_data.py) -> average
power profiles (incomplete days excluded) -> two metrics -> optimal
time-window search -> user-friendly recommendations.

Two layers, two metrics (deliberately different - measured, not assumed):
- Individual (resident's own roof): self-sufficiency % - solar rarely
  exceeds the house's own demand, so this stays meaningful (0-100%).
- Neighborhood (community house + carport, shared PV/battery/EV hub):
  surplus in Watts - solar regularly exceeds demand here, so a capped
  percentage would hide real magnitude. Surplus preserves it. Battery
  charging draw is subtracted from available surplus, since power going
  into the battery isn't actually free for someone else to use right now
  (confirmed from the data: ENE_CNT_IMP >> ENE_CNT_EXP, i.e. this battery
  mostly charges rather than discharges in this dataset).

Two recommendation shapes (also measured, not assumed):
- Fixed-duration appliances (dishwasher, washing machine, dryer, EV
  charger): real cycle duration measured from power-trace bursts ->
  best_window() finds the single best contiguous slot to run it.
- Demand-driven appliances (boiler): NOT schedulable the same way. Real
  cycle durations range continuously from 5 to 655 minutes with no
  natural cluster (measured directly from resident.csv), because it's
  thermostat-driven, not a fixed program. Gets a threshold-trigger
  recommendation instead of a fixed window.
"""

import pandas as pd
import numpy as np
from pathlib import Path

SLOT_MINUTES = 15
SLOTS_PER_DAY = 96
CLEAN_DIR = Path("data/cleaned")


# ---------------------------------------------------------------------------
# Loading + profiles
# ---------------------------------------------------------------------------

def load_clean_csv(filename: str) -> pd.DataFrame:
    """Load an already-cleaned CSV (see clean_data.py). Expects a
    `day_is_complete` column already present."""
    df = pd.read_csv(CLEAN_DIR / filename, low_memory=False)
    df["_time"] = pd.to_datetime(df["_time"], utc=True)
    df["slot"] = df["_time"].dt.hour * 4 + df["_time"].dt.minute // 15
    return df


def average_profile(df: pd.DataFrame, etype: str, field: str = "POW",
                     ctypec: str | None = None, abs_val: bool = False,
                     only_complete_days: bool = True) -> pd.Series:
    """
    Average power (W) for one device type, per 15-min slot, across all
    (complete) days in the file. Returns a 96-length Series, slots 0..95.
    """
    sub = df[(df["ETYPE"] == etype) & (df["_field"] == field)]
    if ctypec:
        sub = sub[sub["CTYPEC"] == ctypec]
    if only_complete_days and "day_is_complete" in df.columns:
        sub = sub[sub["day_is_complete"]]
    sub = sub.copy()
    if abs_val:
        sub["_value"] = sub["_value"].abs()
    return sub.groupby("slot")["_value"].mean().reindex(range(SLOTS_PER_DAY)).fillna(0)


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

def self_sufficiency_pct(solar: pd.Series, consumption: pd.Series) -> pd.Series:
    """Individual metric. Capped at 100% - valid because solar rarely exceeds demand here."""
    return (np.minimum(solar, consumption) / consumption.replace(0, np.nan) * 100).fillna(0)


def surplus_watts(solar: pd.Series, consumption: pd.Series) -> pd.Series:
    """Neighborhood metric. Uncapped - preserves real magnitude of spare capacity."""
    return solar - consumption


# ---------------------------------------------------------------------------
# Window search
# ---------------------------------------------------------------------------

def slot_to_hhmm(slot: int) -> str:
    return f"{slot // 4:02d}:{(slot % 4) * 15:02d}"


def best_window(signal: pd.Series, duration_minutes: int) -> dict:
    """For fixed-duration appliances. Slides a window across the 96 slots
    (no wraparound), returns the highest-average window."""
    n_slots = max(1, duration_minutes // SLOT_MINUTES)
    arr = signal.values
    best_start, best_val = 0, -np.inf
    for start in range(0, SLOTS_PER_DAY - n_slots + 1):
        val = arr[start:start + n_slots].mean()
        if val > best_val:
            best_val, best_start = val, start
    return {
        "start": slot_to_hhmm(best_start),
        "end": slot_to_hhmm(best_start + n_slots),
        "avg_value": round(float(best_val), 1),
    }


def measured_trigger_threshold(signal: pd.Series, percentile: float = 75) -> float:
    """Derives a 'high signal' threshold from the data's own distribution."""
    return float(signal.quantile(percentile / 100))


def high_signal_windows(signal: pd.Series, threshold: float) -> list[dict]:
    """For demand-driven appliances (boiler). Returns all contiguous
    stretches at/above `threshold` - moments worth a 'good time now'
    notification, with no fixed duration attached."""
    above = signal.values >= threshold
    windows, start = [], None
    for i, is_above in enumerate(above):
        if is_above and start is None:
            start = i
        elif not is_above and start is not None:
            windows.append(_make_window(signal, start, i, threshold))
            start = None
    if start is not None:
        windows.append(_make_window(signal, start, SLOTS_PER_DAY, threshold))
    return windows


def _make_window(signal, start, end, threshold) -> dict:
    return {
        "start": slot_to_hhmm(start),
        "end": slot_to_hhmm(end),
        "avg_value": round(float(signal.values[start:end].mean()), 1),
        "threshold_used": round(threshold, 1),
    }


# ---------------------------------------------------------------------------
# User-friendly recommendation layer
# ---------------------------------------------------------------------------

def friendly_fixed(appliance_label: str, window: dict, metric_label: str, metric_suffix: str) -> str:
    return (f"This is the best time to run your {appliance_label}: "
            f"{window['start']}\u2013{window['end']} "
            f"({window['avg_value']}{metric_suffix} {metric_label})")


def friendly_trigger(appliance_label: str, windows: list[dict]) -> str:
    if not windows:
        return f"No strong window found today for your {appliance_label} - conditions are fairly flat."
    w = max(windows, key=lambda x: x["avg_value"])
    return (f"Good conditions to top up your {appliance_label} between "
            f"{w['start']}\u2013{w['end']} "
            f"({w['avg_value']}% self-sufficient)")


def get_individual_recommendations() -> list[dict]:
    """Returns a list of {appliance, message, window} for the resident's own home."""
    resident = load_clean_csv("resident.csv")
    solar = average_profile(resident, "solarpanel", abs_val=True)
    cons = average_profile(resident, "powermeter", ctypec="consumption")
    suff = self_sufficiency_pct(solar, cons)

    recs = []

    dw = best_window(suff, duration_minutes=15)
    recs.append({
        "appliance": "dishwasher",
        "type": "fixed_window",
        "window": dw,
        "message": friendly_fixed("dishwasher", dw, "sun-powered", "%"),
    })

    wm = best_window(suff, duration_minutes=30)
    recs.append({
        "appliance": "washing machine",
        "type": "fixed_window",
        "window": wm,
        "message": friendly_fixed("washing machine", wm, "sun-powered", "%"),
    })

    threshold = measured_trigger_threshold(suff, percentile=75)
    windows = high_signal_windows(suff, threshold)
    recs.append({
        "appliance": "boiler",
        "type": "threshold_trigger",
        "threshold_pct": round(threshold, 1),
        "windows": windows,
        "message": friendly_trigger("boiler / hot water", windows),
    })

    return recs


def get_neighborhood_recommendations() -> list[dict]:
    """Returns a list of {appliance, message, window} for shared community assets."""
    community = load_clean_csv("community_house.csv")
    carport = load_clean_csv("carport.csv")

    ch_solar = average_profile(community, "solarpanel", abs_val=True)
    ch_cons = average_profile(community, "powermeter", ctypec="consumption")
    cp_solar = average_profile(carport, "solarpanel", abs_val=True)
    cp_cons = average_profile(carport, "powermeter", ctypec="consumption")
    cp_batt = average_profile(carport, "battery")  # charging draw, treated as consumption

    nb_solar = ch_solar + cp_solar
    nb_cons = ch_cons + cp_cons + cp_batt
    nb_surplus = surplus_watts(nb_solar, nb_cons)

    recs = []

    wash = best_window(nb_surplus, duration_minutes=15)
    recs.append({
        "appliance": "community washing machine",
        "type": "fixed_window",
        "window": wash,
        "message": friendly_fixed("community washing machine", wash, "spare neighborhood power", "W"),
    })

    dry = best_window(nb_surplus, duration_minutes=15)
    recs.append({
        "appliance": "community dryer",
        "type": "fixed_window",
        "window": dry,
        "message": friendly_fixed("community dryer", dry, "spare neighborhood power", "W"),
    })

    ev = best_window(nb_surplus, duration_minutes=180)
    recs.append({
        "appliance": "EV charger",
        "type": "fixed_window",
        "window": ev,
        "message": friendly_fixed("EV charger", ev, "spare neighborhood power", "W"),
    })

    return recs


if __name__ == "__main__":
    print("=== INDIVIDUAL (your home) ===")
    for r in get_individual_recommendations():
        print(f"  - {r['message']}")

    print("\n=== NEIGHBORHOOD (shared assets) ===")
    for r in get_neighborhood_recommendations():
        print(f"  - {r['message']}")