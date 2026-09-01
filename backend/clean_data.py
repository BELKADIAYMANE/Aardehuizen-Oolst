"""
clean_data.py

Cleans the raw energy CSVs before they're used for forecasting.

What "clean" means here, based on what we actually found in the data:
1. Header whitespace: source files have leading spaces baked into some
   column names (e.g. '    _time'). Strip all column names.
2. Day completeness: some days have entire hours of missing readings
   (confirmed: Apr 13-21 window has a degraded/missing stretch, including
   2 fully missing days). A forecast built on a "yesterday" or "last N
   days" basis would silently break if it draws from a degraded day.
   -> Flag any day whose row count falls below a data-driven threshold
      (50% of the MEDIAN daily row count for that file - not a guessed
      round number), rather than deleting rows silently.
3. Output: writes a cleaned CSV (all rows kept, but with a boolean
   `day_is_complete` column added) plus a short completeness report
   printed to the console. Nothing is silently deleted - the forecast
   function decides what to do with incomplete days (exclude them from
   training windows, interpolate, etc.) using this flag.
"""

import pandas as pd
from pathlib import Path

RAW_DIR = Path("data")
CLEAN_DIR = Path("data/cleaned")


def clean_file(filename: str) -> pd.DataFrame:
    raw_path = RAW_DIR / filename
    df = pd.read_csv(raw_path, low_memory=False)

    # --- 1. header whitespace fix ---
    df.columns = df.columns.str.strip()
    df["_time"] = pd.to_datetime(df["_time"], utc=True)

    # --- 2. day completeness check ---
    df["date"] = df["_time"].dt.date
    daily_counts = df.groupby("date").size()
    median_count = daily_counts.median()
    threshold = median_count * 0.5

    complete_days = set(daily_counts[daily_counts >= threshold].index)
    df["day_is_complete"] = df["date"].isin(complete_days)

    # --- report (console only, not saved - for you to read now) ---
    incomplete = daily_counts[daily_counts < threshold]
    print(f"\n--- {filename} ---")
    print(f"Median rows/day: {median_count:.0f}  |  threshold (50%): {threshold:.0f}")
    if len(incomplete) == 0:
        print("No incomplete days found.")
    else:
        print(f"{len(incomplete)} incomplete day(s) flagged (day_is_complete=False):")
        for d, count in incomplete.items():
            print(f"   {d}: {count} rows ({count/median_count*100:.0f}% of median)")

    # check for fully MISSING calendar days too (0 rows, so they won't appear above)
    all_days = pd.date_range(df["_time"].min().normalize(), df["_time"].max().normalize(), freq="D")
    all_days = {d.date() for d in all_days}
    present_days = set(daily_counts.index)
    fully_missing = sorted(all_days - present_days)
    if fully_missing:
        print(f"Fully missing calendar day(s) (0 rows, not in file at all): {fully_missing}")

    df = df.drop(columns=["date"])  # was only needed for the check above
    return df


def main():
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    for filename in ["resident.csv", "community_house.csv", "carport.csv"]:
        cleaned = clean_file(filename)
        out_path = CLEAN_DIR / filename
        cleaned.to_csv(out_path, index=False)
        print(f"Saved -> {out_path}  ({len(cleaned)} rows)")


if __name__ == "__main__":
    main()