import requests
import pandas as pd

OLST_LAT = 52.3372
OLST_LON = 6.1122
TIMEZONE = "Europe/Amsterdam"

HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/archive"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def fetch_historical_weather(start_date: str, end_date: str) -> pd.DataFrame:
    params = {
        "latitude": OLST_LAT,
        "longitude": OLST_LON,
        "start_date": start_date,
        "end_date": end_date,
        "hourly": "shortwave_radiation,cloud_cover,temperature_2m",
        "timezone": TIMEZONE,
    }
    resp = requests.get(HISTORICAL_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()["hourly"]
    df = pd.DataFrame(data)
    df["time"] = pd.to_datetime(df["time"])
    return df


def fetch_forecast_weather(days_ahead: int = 2) -> pd.DataFrame:
    params = {
        "latitude": OLST_LAT,
        "longitude": OLST_LON,
        "hourly": "shortwave_radiation,cloud_cover,temperature_2m",
        "forecast_days": days_ahead,
        "timezone": TIMEZONE,
    }
    resp = requests.get(FORECAST_URL, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()["hourly"]
    df = pd.DataFrame(data)
    df["time"] = pd.to_datetime(df["time"])
    return df


if __name__ == "__main__":
    hist = fetch_historical_weather("2026-03-29", "2026-04-29")
    print(hist.head(10))
    print(len(hist))
    print(hist["shortwave_radiation"].isnull().any())

    fc = fetch_forecast_weather(days_ahead=2)
    print(fc.head(10))