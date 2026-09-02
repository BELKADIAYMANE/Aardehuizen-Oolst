import pandas as pd
import numpy as np

MIN_COVERAGE_PCT = 70


def daily_kwh(df: pd.DataFrame, etype: str = "powermeter", ctypec: str | None = "consumption",
              max_gap_min: int = 20) -> pd.Series:
    sub = df[(df["ETYPE"] == etype) & (df["_field"] == "POW")]
    if ctypec:
        sub = sub[sub["CTYPEC"] == ctypec]
    sub = sub.sort_values("_time").copy()
    sub["dt_hours"] = sub["_time"].diff().dt.total_seconds() / 3600
    sub.loc[sub["dt_hours"] > max_gap_min / 60, "dt_hours"] = np.nan
    sub["wh"] = sub["_value"] * sub["dt_hours"]
    sub["date"] = sub["_time"].dt.date
    return sub.groupby("date")["wh"].sum() / 1000


def monthly_total_kwh(df: pd.DataFrame, year: int, month: int) -> dict:
    daily = daily_kwh(df)
    idx = pd.to_datetime(daily.index)
    in_month = daily[(idx.year == year) & (idx.month == month)]
    days_in_month = pd.Period(f"{year}-{month:02d}").days_in_month
    days_present = len(in_month)
    coverage_pct = days_present / days_in_month * 100
    return {
        "year": year,
        "month": month,
        "total_kwh": round(float(in_month.sum()), 2),
        "days_present": days_present,
        "days_in_month": days_in_month,
        "coverage_pct": round(coverage_pct, 1),
    }


def check_monthly_alert(df: pd.DataFrame, current_year: int, current_month: int,
                         previous_year: int, previous_month: int) -> dict:
    current = monthly_total_kwh(df, current_year, current_month)
    previous = monthly_total_kwh(df, previous_year, previous_month)

    reliable = (current["coverage_pct"] >= MIN_COVERAGE_PCT
                and previous["coverage_pct"] >= MIN_COVERAGE_PCT)

    if not reliable:
        return {
            "current": current,
            "previous": previous,
            "reliable": False,
            "alert": False,
            "message": (f"Not enough data to compare reliably "
                        f"(current month coverage: {current['coverage_pct']}%, "
                        f"previous month coverage: {previous['coverage_pct']}%, "
                        f"minimum required: {MIN_COVERAGE_PCT}%)."),
        }

    pct_change = ((current["total_kwh"] - previous["total_kwh"]) / previous["total_kwh"]) * 100
    is_increase = current["total_kwh"] > previous["total_kwh"]

    if is_increase:
        message = (f"Your energy consumption is increasing over time: "
                   f"{current['total_kwh']} kWh this month vs "
                   f"{previous['total_kwh']} kWh last month "
                   f"(+{pct_change:.1f}%).")
    else:
        message = (f"Your energy consumption is down this month: "
                   f"{current['total_kwh']} kWh vs "
                   f"{previous['total_kwh']} kWh last month "
                   f"({pct_change:.1f}%).")

    return {
        "current": current,
        "previous": previous,
        "reliable": True,
        "alert": is_increase,
        "pct_change": round(pct_change, 1),
        "message": message,
    }


if __name__ == "__main__":
    df = pd.read_csv("data/cleaned/resident.csv", low_memory=False)
    df["_time"] = pd.to_datetime(df["_time"], utc=True)

    result = check_monthly_alert(df, 2026, 4, 2026, 3)
    print(result["message"])
    print(f"reliable: {result['reliable']}")
    print(f"current: {result['current']}")
    print(f"previous: {result['previous']}")