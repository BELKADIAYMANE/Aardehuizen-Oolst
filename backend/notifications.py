import json
import pandas as pd
from pathlib import Path
from exponent_server_sdk import PushClient, PushMessage, PushServerError, DeviceNotRegisteredError

import weather

DEVICES_FILE = Path("data/devices.json")

push_client = PushClient()

MESSAGES = {
    "sunny":  ("☀️ Good time to run appliances", "It's sunny at {label} — solar is likely covering your usage."),
    "rainy":  ("🌧️ Better to hold off", "It's raining at {label} — mostly grid power for now."),
    "cloudy": ("⛅ Limited solar right now", "It's cloudy at {label} — solar output will be low."),
    "night":  ("🌙 No solar overnight", "It's nighttime at {label} — appliances will run on grid power."),
}

# sunny/cloudy/rainy/night classifications match what you see outside.
RAIN_MM_THRESHOLD = 0.1          # threshold for rain in mm/h
NIGHT_RADIATION_THRESHOLD = 5    # W/m^2 near-zero solar radiation = night
SUNNY_RADIATION_THRESHOLD = 300  # W/m^2
SUNNY_CLOUD_COVER_MAX = 30       # percent

# Device registration
def load_devices() -> dict:
    if not DEVICES_FILE.exists():
        return {}
    return json.loads(DEVICES_FILE.read_text())


def save_devices(devices: dict) -> None:
    DEVICES_FILE.parent.mkdir(parents=True, exist_ok=True)
    DEVICES_FILE.write_text(json.dumps(devices, indent=2))


def register_device(push_token: str, label: str = "Home") -> None:
    devices = load_devices()
    existing = devices.get(push_token, {})
    devices[push_token] = {
        "label": label,
        # last_condition is used to avoid sending duplicate notifications for the same condition
        "last_condition": existing.get("last_condition"),
    }
    save_devices(devices)


# Weather classification and current condition
def classify(precipitation: float, shortwave_radiation: float, cloud_cover: float) -> str:
    if precipitation >= RAIN_MM_THRESHOLD:
        return "rainy"
    if shortwave_radiation <= NIGHT_RADIATION_THRESHOLD:
        return "night"
    if shortwave_radiation > SUNNY_RADIATION_THRESHOLD and cloud_cover < SUNNY_CLOUD_COVER_MAX:
        return "sunny"
    return "cloudy"


def fetch_current_condition() -> dict:
    fc = weather.fetch_forecast_weather(days_ahead=1)
    now = pd.Timestamp.now(tz=weather.TIMEZONE).tz_localize(None)
    row = fc.iloc[(fc["time"] - now).abs().argsort().iloc[0]]

    condition = classify(
        precipitation=float(row["precipitation"]),
        shortwave_radiation=float(row["shortwave_radiation"]),
        cloud_cover=float(row["cloud_cover"]),
    )
    return {"condition": condition, "tempC": float(row["temperature_2m"])}


# Notifications  
def send_push(push_token: str, condition: str, label: str) -> None:
    title, body_template = MESSAGES[condition]
    body = body_template.format(label=label)
    try:
        push_client.publish(PushMessage(to=push_token, title=title, body=body, sound="default"))
    except DeviceNotRegisteredError:
        devices = load_devices()
        devices.pop(push_token, None)
        save_devices(devices)
    except PushServerError as e:
        print(f"Push failed for {label}: {e}")

# Timed checks
def check_all_devices() -> None:
    devices = load_devices()
    if not devices:
        return

    try:
        result = fetch_current_condition()
    except Exception as e:
        print(f"Weather forecast check failed: {e}")
        return

    condition = result["condition"]
    for push_token, info in devices.items():
        if condition != info.get("last_condition"):
            send_push(push_token, condition, info.get("label", "Home"))
            info["last_condition"] = condition

    save_devices(devices)