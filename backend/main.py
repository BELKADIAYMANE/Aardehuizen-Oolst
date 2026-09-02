from datetime import date, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import scoring
import forecast

app = FastAPI(title="Buurstroom API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache = {}


def _compute_all():
    _cache["individual"] = scoring.get_individual_recommendations()
    _cache["neighborhood"] = scoring.get_neighborhood_recommendations()


@app.on_event("startup")
def startup():
    _compute_all()


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


@app.get("/individual/forecast-week")
def individual_forecast_week(start_date: str | None = None, days: int = 7):
    """Seven-day individual forecast using the same method as /individual/forecast."""
    start = start_date or date.today().isoformat()
    try:
        return forecast.get_week_forecast(start, days)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Forecast failed: {e}")


@app.get("/home")
def home():
    """Today + tomorrow for the app/widget. Existing routes are unchanged."""
    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    try:
        return {
            "today_date": today,
            "tomorrow_date": tomorrow,
            "today": forecast.get_individual_forecast(today),
            "tomorrow": forecast.get_individual_forecast(tomorrow),
            "neighborhood": _cache.get("neighborhood", []),
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Forecast failed: {e}")