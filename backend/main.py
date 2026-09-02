import notifications
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from pydantic import BaseModel
import scoring
import forecast
import weather

app = FastAPI(title="Buurstroom API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache = {}
scheduler = BackgroundScheduler()

lat = weather.OLST_LAT
lon = weather.OLST_LON

def _compute_all():
    _cache["individual"] = scoring.get_individual_recommendations()
    _cache["neighborhood"] = scoring.get_neighborhood_recommendations()


@app.on_event("startup")
def startup():
    _compute_all()
    scheduler.add_job(_compute_all, "interval", minutes=15)#Check every 15 minutes for new recommendations
    scheduler.start()


@app.get("/")
def root():
    return {"status": "ok", "service": "buurstroom-api"}


@app.get("/individual/best-times")
def individual_best_times():
    return _cache["individual"]


@app.get("/neighborhood/best-times")
def neighborhood_best_times():
    return _cache["neighborhood"]


@app.get("/individual/forecast")
def individual_forecast(target_date: str):
    try:
        return forecast.get_individual_forecast(target_date)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Forecast failed: {e}")

# Push notifications

class RegisterRequest(BaseModel):
    pushToken: str
    label: str = "Home"
    lat: float | None = None
    lon: float | None = None


@app.post("/register")
def register_device(request: RegisterRequest):
    notifications.register_device(request.pushToken, request.label)
    return {"status": "ok"}


@app.get("/weather")
def current_weather(lat: float | None = None, lon: float | None = None):
    try:
        return notifications.fetch_current_condition()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Weather fetch failed: {e}")


@app.post("/test-notification")
def test_push():
    devices = notifications.load_devices()
    if not devices:
        return {"sent": 0, "message": "No registered devices"}
    for push_token, info in devices.items():
        notifications.push_client.publish(
            notifications.PushMessage(
                to=push_token,
                title="Test notification",
                body="If you see this, push delivery is working!",
                sound="default",
            )
        )
    return {"sent": len(devices)}