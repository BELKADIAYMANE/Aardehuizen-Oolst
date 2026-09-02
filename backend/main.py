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