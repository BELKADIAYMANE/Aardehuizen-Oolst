/** Same-origin proxy so phones can load the app without talking to port 8000. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "/api-backend";

export type TimeWindow = {
  start: string;
  end: string;
  avg_value: number;
};

export type Recommendation = {
  appliance: string;
  type: string;
  message: string;
  window?: TimeWindow;
  windows?: TimeWindow[];
  threshold_pct?: number;
};

export type HomeData = {
  today_date: string;
  tomorrow_date: string;
  today: Recommendation[];
  tomorrow: Recommendation[];
  neighborhood: Recommendation[];
};

export type SimpleChoice = {
  id: string;
  title: string;
  when: string;
  go: boolean;
  reason: string;
};

/** Spare watts above this = "yes". Never shown in the UI. */
const SPARE_OK_WATTS = 2000;

function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchHome(): Promise<HomeData> {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const todayDate = localIso(today);
  const tomorrowDate = localIso(tomorrow);

  const [todayRes, tomorrowRes, neighborhoodRes] = await Promise.all([
    fetch(`${API_BASE}/individual/forecast?target_date=${todayDate}`, { cache: "no-store" }),
    fetch(`${API_BASE}/individual/forecast?target_date=${tomorrowDate}`, { cache: "no-store" }),
    fetch(`${API_BASE}/neighborhood/best-times`, { cache: "no-store" }),
  ]);

  if (!todayRes.ok || !tomorrowRes.ok) {
    throw new Error("Could not load the Aardehuizen forecast.");
  }

  const neighborhood = neighborhoodRes.ok ? await neighborhoodRes.json() : [];
  return {
    today_date: todayDate,
    tomorrow_date: tomorrowDate,
    today: await todayRes.json(),
    tomorrow: await tomorrowRes.json(),
    neighborhood: Array.isArray(neighborhood) ? neighborhood : neighborhood.value ?? [],
  };
}

export function pickWasher(recs: Recommendation[]) {
  return recs.find((r) => r.appliance.includes("washing")) ?? recs[0];
}

export function pickDishwasher(recs: Recommendation[]) {
  return recs.find((r) => r.appliance.includes("dishwasher"));
}

export function pickBoiler(recs: Recommendation[]) {
  return recs.find((r) => r.appliance.includes("boiler"));
}

export function neighbourhoodChoices(recs: Recommendation[]): SimpleChoice[] {
  const laundry = recs.find(
    (r) => r.appliance.includes("washing") || r.appliance.includes("dryer"),
  );
  const ev = recs.find((r) => r.appliance.includes("EV") || r.appliance.includes("charger"));
  const choices: SimpleChoice[] = [];

  if (laundry?.window) {
    const go = laundry.window.avg_value >= SPARE_OK_WATTS;
    choices.push({
      id: "laundry",
      title: "Shared washer or dryer?",
      when: `${laundry.window.start}–${laundry.window.end}`,
      go,
      reason: go
        ? "Yes — a good time to use the shared laundry."
        : "Wait — better to use it later.",
    });
  }

  if (ev?.window) {
    const go = ev.window.avg_value >= SPARE_OK_WATTS;
    choices.push({
      id: "ev",
      title: "Shared EV charger?",
      when: `${ev.window.start}–${ev.window.end}`,
      go,
      reason: go
        ? "Yes — a good time to plug in."
        : "Wait — better to charge later.",
    });
  }

  return choices;
}

/** Map HH:MM onto the 6:00–21:00 widget bar (0–100). */
export function hourToBarPct(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h + m / 60;
  return Math.min(100, Math.max(0, ((hour - 6) / 15) * 100));
}

export function nowBarPct(date = new Date()): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  return Math.min(100, Math.max(0, ((hour - 6) / 15) * 100));
}
