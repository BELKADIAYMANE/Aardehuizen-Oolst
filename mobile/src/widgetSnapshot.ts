import {
  abundanceFromRecs,
  dateLabel,
  hourToBarPct,
  neighbourhoodChoices,
  nowBarPct,
  pickWasher,
  type HomeData,
  type Recommendation,
} from "./api";

export type DayForecast = {
  title: string;
  tip: string;
  pct: number;
  bandLeft: number;
  bandWidth: number;
  marker: number;
  peakLabel: string;
};

export type NeighbourhoodLine = {
  title: string;
  detail: string;
  go: boolean | null;
};

export type WidgetSnapshot = {
  day: DayForecast;
  dayIndex: number;
  dayCount: number;
  laundry: NeighbourhoodLine;
  ev: NeighbourhoodLine;
  error?: string;
};

function parseWindowStart(isoDate: string, hhmm: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export function clampDayIndex(index: number, count: number) {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

export function nextBestDayIndex(data: HomeData) {
  const now = Date.now();
  for (let i = 0; i < data.days.length; i += 1) {
    const window = pickWasher(data.days[i].recs)?.window;
    if (!window) continue;
    const start = parseWindowStart(data.days[i].date, window.start);
    const end = parseWindowStart(data.days[i].date, window.end);
    if (end.getTime() + 15 * 60 * 1000 > now || start.getTime() > now) {
      return i;
    }
  }
  return 0;
}

function dayFromRecs(
  title: string,
  recs: Recommendation[],
  marker: number,
  peakLabel: string,
): DayForecast {
  const washer = pickWasher(recs);
  const window = washer?.window;
  const pct = window ? Math.round(window.avg_value) : 0;
  const abundance = abundanceFromRecs(recs);
  const bandLeft = abundance.left;
  const bandWidth = abundance.width;

  return {
    title,
    tip: window
      ? `Best time for the washing machine: ${window.start}–${window.end} (${pct}% from your roof).`
      : "No good window yet",
    pct,
    bandLeft,
    bandWidth,
    marker,
    peakLabel,
  };
}

const emptyLine = (title: string, detail: string): NeighbourhoodLine => ({
  title,
  detail,
  go: null,
});

function neighbourhoodFrom(data?: HomeData): Pick<WidgetSnapshot, "laundry" | "ev"> {
  const choices = neighbourhoodChoices(data?.neighborhood ?? []);
  const laundry = choices.find((c) => c.id === "laundry");
  const ev = choices.find((c) => c.id === "ev");
  return {
    laundry: laundry
      ? {
          title: "Shared washer or dryer",
          detail: `${laundry.when} · ${laundry.go ? "Yes" : "Wait"} — neighbourhood laundry room`,
          go: laundry.go,
        }
      : emptyLine("Shared washer or dryer", "No neighbourhood laundry window yet."),
    ev: ev
      ? {
          title: "Shared EV charger",
          detail: `${ev.when} · ${ev.go ? "Yes" : "Wait"} — neighbourhood carport charger`,
          go: ev.go,
        }
      : emptyLine("Shared EV charger", "No neighbourhood charger window yet."),
  };
}

export function emptySnapshot(error?: string): WidgetSnapshot {
  return {
    day: {
      title: "Today",
      tip: error ?? "Waiting for the Olst forecast…",
      pct: 0,
      bandLeft: 40,
      bandWidth: (30 / 900) * 100,
      marker: nowBarPct(),
      peakLabel: "Solar peak",
    },
    dayIndex: 0,
    dayCount: 7,
    ...neighbourhoodFrom(),
    error,
  };
}

export function snapshotFromHome(data: HomeData, dayIndex = 0): WidgetSnapshot {
  const index = clampDayIndex(dayIndex, data.days.length);
  const selected = data.days[index];
  return {
    day: dayFromRecs(
      selected ? dateLabel(selected.date) : "Olst forecast",
      selected?.recs ?? [],
      index === 0
        ? nowBarPct()
        : hourToBarPct(pickWasher(selected?.recs ?? [])?.window?.start ?? "12:00"),
      index === 0 ? "Solar peak" : "Forecast peak",
    ),
    dayIndex: index,
    dayCount: data.days.length || 7,
    ...neighbourhoodFrom(data),
  };
}
