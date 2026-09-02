import numpy as np
import pandas as pd
from pathlib import Path

import scoring
import weather

SLOT_MINUTES = 15
SLOTS_PER_DAY = 96


def calibrate_solar_model(resident_df: pd.DataFrame, hist_weather_df: pd.DataFrame) -> float:
    solar = resident_df[(resident_df["ETYPE"] == "solarpanel") & (resident_df["_field"] == "POW")].copy()
    solar["_value"] = solar["_value"].abs()
    solar_hourly = solar.set_index("_time")["_value"].resample("1h").mean().rename("solar")

    w = hist_weather_df.set_index("time")["shortwave_radiation"].rename("radiation")
    w.index = w.index.tz_localize("Europe/Amsterdam", nonexistent="shift_forward", ambiguous="NaT").tz_convert("UTC")
    w = w[w.index.notna()]

    merged = pd.merge(solar_hourly, w, left_index=True, right_index=True, how="inner").dropna()
    merged = merged[merged["radiation"] > 0]

    k = float((merged["solar"] * merged["radiation"]).sum() / (merged["radiation"] ** 2).sum())
    return k


def forecast_solar_curve(forecast_weather_df: pd.DataFrame, k: float, target_date: str) -> pd.Series:
    fc = forecast_weather_df.copy()
    fc["time"] = fc["time"].dt.tz_localize("Europe/Amsterdam", nonexistent="shift_forward", ambiguous="NaT").dt.tz_convert("UTC")
    fc = fc[fc["time"].notna()]

    target_start = pd.Timestamp(target_date, tz="Europe/Amsterdam").tz_convert("UTC")
    target_end = target_start + pd.Timedelta(days=1)

    day = fc[(fc["time"] >= target_start) & (fc["time"] < target_end)].copy()
    day = day.set_index("time")["shortwave_radiation"]
    day_15min = day.resample("15min").interpolate(method="linear")
    day_15min = day_15min.reindex(pd.date_range(target_start, periods=SLOTS_PER_DAY, freq="15min", tz="UTC"))
    predicted = (day_15min * k).fillna(0)
    predicted.index = [((t.hour * 4) + t.minute // 15) for t in predicted.index]
    predicted = predicted.reindex(range(SLOTS_PER_DAY)).fillna(0)
    return predicted


def forecast_consumption_curve(cleaned_df: pd.DataFrame, etype: str, ctypec: str | None, n_days: int = 7) -> pd.Series:
    df = cleaned_df[cleaned_df["day_is_complete"]].copy()
    df["date"] = df["_time"].dt.date
    recent_days = sorted(df["date"].unique())[-n_days:]
    df = df[df["date"].isin(recent_days)]

    sub = df[(df["ETYPE"] == etype) & (df["_field"] == "POW")]
    if ctypec:
        sub = sub[sub["CTYPEC"] == ctypec]
    return sub.groupby("slot")["_value"].mean().reindex(range(SLOTS_PER_DAY)).fillna(0)


def _recs_from_curves(predicted_solar: pd.Series, predicted_cons: pd.Series) -> list[dict]:
    predicted_suff = scoring.self_sufficiency_pct(predicted_solar, predicted_cons)
    recs = []

    dw = scoring.best_window(predicted_suff, duration_minutes=15)
    recs.append({
        "appliance": "dishwasher",
        "type": "fixed_window",
        "window": dw,
        "message": scoring.friendly_fixed("dishwasher", dw, "sun-powered", "%"),
    })

    wm = scoring.best_window(predicted_suff, duration_minutes=30)
    recs.append({
        "appliance": "washing machine",
        "type": "fixed_window",
        "window": wm,
        "message": scoring.friendly_fixed("washing machine", wm, "sun-powered", "%"),
    })

    threshold = scoring.measured_trigger_threshold(predicted_suff, percentile=75)
    windows = scoring.high_signal_windows(predicted_suff, threshold)
    recs.append({
        "appliance": "boiler",
        "type": "threshold_trigger",
        "threshold_pct": round(threshold, 1),
        "windows": windows,
        "message": scoring.friendly_trigger("boiler / hot water", windows),
    })

    return recs


def _calibrated_forecast_inputs(days_ahead: int = 8):
    resident_clean = scoring.load_clean_csv("resident.csv")
    hist_weather = weather.fetch_model_historical("2026-03-29", "2026-04-29")
    k = calibrate_solar_model(resident_clean, hist_weather)
    fc_weather = weather.fetch_forecast_weather(days_ahead=days_ahead)
    predicted_cons = forecast_consumption_curve(resident_clean, "powermeter", "consumption", n_days=7)
    return fc_weather, k, predicted_cons


def get_individual_forecast(target_date: str) -> list[dict]:
    fc_weather, k, predicted_cons = _calibrated_forecast_inputs(days_ahead=8)
    predicted_solar = forecast_solar_curve(fc_weather, k, target_date)
    return _recs_from_curves(predicted_solar, predicted_cons)


def get_week_forecast(start_date: str, days: int = 7) -> dict:
    """Same individual forecast method, one ECMWF pull, today through +6 days."""
    from datetime import date, timedelta

    days = min(max(int(days), 1), 8)
    start = date.fromisoformat(start_date)
    fc_weather, k, predicted_cons = _calibrated_forecast_inputs(days_ahead=max(days + 1, 8))

    out = []
    for offset in range(days):
        day = start + timedelta(days=offset)
        iso = day.isoformat()
        predicted_solar = forecast_solar_curve(fc_weather, k, iso)
        out.append({
            "date": iso,
            "recommendations": _recs_from_curves(predicted_solar, predicted_cons),
        })

    return {"start_date": start_date, "days": out}


if __name__ == "__main__":
    import datetime
    tomorrow = (datetime.date.today() + datetime.timedelta(days=1)).isoformat()
    print(f"Forecast for {tomorrow}:")
    for r in get_individual_forecast(tomorrow):
        print(f"  - {r['message']}")