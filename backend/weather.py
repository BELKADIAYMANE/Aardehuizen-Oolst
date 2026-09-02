import time
import requests
import pandas as pd

_WEATHER_CACHE: dict[str, tuple[float, pd.DataFrame]] = {}
_CACHE_TTL_SECONDS = 10 * 60

OLST_LAT = 52.3372
OLST_LON = 6.1122
TIMEZONE = "Europe/Amsterdam"

# ECMWF IFS scored best on Aardehuizen meters for appliance timing
# (day-ahead dishwasher slot within 10 pp of the true best on 76.5% of April test days).
FORECAST_MODEL = "ecmwf_ifs"

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"
HISTORICAL_FORECAST_URL = "https://historical-forecast-api.open-meteo.com/v1/forecast"
PREVIOUS_RUNS_URL = "https://previous-runs-api.open-meteo.com/v1/forecast"

HOURLY = "shortwave_radiation,cloud_cover,temperature_2m"


def _hourly_frame(url: str, params: dict) -> pd.DataFrame:
    key = f"{url}|{sorted(params.items())}"
    now = time.time()
    hit = _WEATHER_CACHE.get(key)
    if hit and now - hit[0] < _CACHE_TTL_SECONDS:
        return hit[1].copy()
    resp = requests.get(url, params=params, timeout=45)
    resp.raise_for_status()
    data = resp.json()["hourly"]
    df = pd.DataFrame(data)
    df["time"] = pd.to_datetime(df["time"])
    _WEATHER_CACHE[key] = (now, df)
    return df.copy()


def fetch_historical_weather(start_date: str, end_date: str) -> pd.DataFrame:
    """ERA5 archive — observed-style radiation, used as a truth baseline."""
    return _hourly_frame(HISTORICAL_URL, {
        "latitude": OLST_LAT,
        "longitude": OLST_LON,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": HOURLY,
        "timezone": TIMEZONE,
    })


def fetch_model_historical(start_date: str, end_date: str) -> pd.DataFrame:
    """ECMWF IFS radiation from Open-Meteo's historical-forecast archive.
    Used to calibrate k on the same model family as the live forecast."""
    return _hourly_frame(HISTORICAL_FORECAST_URL, {
        "latitude": OLST_LAT,
        "longitude": OLST_LON,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": HOURLY,
        "timezone": TIMEZONE,
        "models": FORECAST_MODEL,
    })


def fetch_forecast_weather(days_ahead: int = 2) -> pd.DataFrame:
    """Live ECMWF IFS forecast for Olst."""
    return _hourly_frame(FORECAST_URL, {
        "latitude": OLST_LAT,
        "longitude": OLST_LON,
        "hourly": HOURLY,
        "forecast_days": int(days_ahead),
        "timezone": TIMEZONE,
        "models": FORECAST_MODEL,
    })


def fetch_previous_runs(start_date: str, end_date: str, model: str = FORECAST_MODEL) -> pd.DataFrame:
    """Archived model runs, including the radiation predicted 24h earlier."""
    return _hourly_frame(PREVIOUS_RUNS_URL, {
        "latitude": OLST_LAT,
        "longitude": OLST_LON,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "shortwave_radiation,shortwave_radiation_previous_day1",
        "timezone": TIMEZONE,
        "models": model,
    })


if __name__ == "__main__":
    hist = fetch_model_historical("2026-03-29", "2026-04-29")
    print(hist.head(10))
    print(len(hist))
    print(hist["shortwave_radiation"].isnull().any())

    fc = fetch_forecast_weather(days_ahead=2)
    print(fc.head(10))
    print("model", FORECAST_MODEL)
