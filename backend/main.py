# backend/main.py
"""
FastAPI wrapper around scoring.py.

Design choice: compute all scores ONCE at startup (our data is static
historical CSVs, per the note in scoring.py) and cache in memory, rather
than reprocessing the CSVs on every request. If this ever moves to
live/rolling data, this is the one place that needs to change.

CORS is wide open for the prototype since the Expo app will call this
from a phone/simulator on the local network, not a predictable browser
origin. Tighten before any real deployment.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import scoring
import datetime

app = FastAPI(title="Buurstroom API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache = {}


def _compute_all():
    resident = scoring.load_csv("data/resident.csv")
    community = scoring.load_csv("data/community_house.csv")
    carport = scoring.load_csv("data/carport.csv")

    r_solar = scoring.average_profile(resident, "solarpanel", abs_val=True)
    r_cons = scoring.average_profile(resident, "powermeter", ctypec="consumption")
    r_suff = scoring.self_sufficiency_pct(r_solar, r_cons)

    ch_solar = scoring.average_profile(community, "solarpanel", abs_val=True)
    ch_cons = scoring.average_profile(community, "powermeter", ctypec="consumption")
    cp_solar = scoring.average_profile(carport, "solarpanel", abs_val=True)
    cp_cons = scoring.average_profile(carport, "powermeter", ctypec="consumption")
    nb_solar = ch_solar + cp_solar
    nb_cons = ch_cons + cp_cons
    nb_surplus = scoring.surplus_watts(nb_solar, nb_cons)

    boiler_threshold = scoring.measured_trigger_threshold(r_suff, percentile=75)

    _cache["individual"] = {
        "self_sufficiency_curve": r_suff.round(1).tolist(),  # 96 values, slot 0..95 (15-min each)
        "appliances": {
            "dishwasher": scoring.best_window(r_suff, 15),
            "washingmachine": scoring.best_window(r_suff, 30),
        },
        "boiler": {
            "type": "threshold_trigger",
            "threshold_pct": round(boiler_threshold, 1),
            "good_windows": scoring.high_signal_windows(r_suff, boiler_threshold),
        },
    }

    _cache["neighborhood"] = {
        "surplus_curve_W": nb_surplus.round(1).tolist(),
        "appliances": {
            "washingmachine": scoring.best_window(nb_surplus, 15),
            "dryermachine": scoring.best_window(nb_surplus, 15),
            "evcharger": scoring.best_window(nb_surplus, 180),
        },
    }


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


@app.get("/individual/current")
def individual_current(slot: int | None = None):
    """Self-sufficiency score for one 15-min slot (0-95). Defaults to now (UTC)."""
    if slot is None:
        now = datetime.datetime.utcnow()
        slot = now.hour * 4 + now.minute // 15
    slot = max(0, min(95, slot))
    curve = _cache["individual"]["self_sufficiency_curve"]
    return {"slot": slot, "time": scoring.slot_to_hhmm(slot), "self_sufficiency_pct": curve[slot]}