import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const API_KEY = "aardehuizen.apiBase";
const HOME_CACHE_KEY = "aardehuizen.homeCache";
const WIDGET_DAY_KEY = "aardehuizen.widgetDay";
const HOTSPOT_API = "http://172.20.10.2:8001";
const EMULATOR_API = "http://10.0.2.2:8001";
/** Works with `adb reverse tcp:8001 tcp:8001` — no Windows firewall needed. */
const EMULATOR_LOOPBACK_API = "http://127.0.0.1:8001";

function isAndroidEmulator() {
  if (Platform.OS !== "android") return false;
  const name = `${Constants.deviceName ?? ""} ${Constants.expoConfig?.hostUri ?? ""}`.toLowerCase();
  return (
    Constants.isDevice === false ||
    name.includes("sdk") ||
    name.includes("emulator") ||
    name.includes("gphone")
  );
}

function uniqueBases(bases: Array<string | undefined>) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of bases) {
    const value = raw?.trim().replace(/\/$/, "");
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

export function defaultApiBase() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const extra = Constants.expoConfig?.extra?.apiBase;
  if (typeof extra === "string" && extra) return extra;
  const hostUri = Constants.expoConfig?.hostUri ?? "";
  const host = hostUri.replace(/^https?:\/\//, "").split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") {
    return `http://${host}:8001`;
  }
  if (isAndroidEmulator()) return EMULATOR_LOOPBACK_API;
  if (Platform.OS === "android") return HOTSPOT_API;
  return "http://127.0.0.1:8001";
}

async function candidateBases() {
  const stored = await getStoredApiBase();
  if (isAndroidEmulator()) {
    return uniqueBases([
      EMULATOR_LOOPBACK_API,
      EMULATOR_API,
      stored,
      defaultApiBase(),
    ]);
  }
  return uniqueBases([stored, defaultApiBase(), HOTSPOT_API, EMULATOR_API]);
}

export async function getStoredApiBase(): Promise<string> {
  const stored = await AsyncStorage.getItem(API_KEY);
  const value = stored?.trim();
  return value || defaultApiBase();
}

export async function setStoredApiBase(url: string) {
  await AsyncStorage.setItem(API_KEY, url.trim().replace(/\/$/, ""));
}

export async function cacheHomeData(data: HomeData) {
  await AsyncStorage.setItem(HOME_CACHE_KEY, JSON.stringify(data));
}

export async function getCachedHomeData(): Promise<HomeData | null> {
  const raw = await AsyncStorage.getItem(HOME_CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HomeData;
    return Array.isArray(parsed?.days) ? parsed : null;
  } catch {
    return null;
  }
}

export async function getWidgetDayIndex() {
  const raw = await AsyncStorage.getItem(WIDGET_DAY_KEY);
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

export async function setWidgetDayIndex(index: number) {
  await AsyncStorage.setItem(WIDGET_DAY_KEY, String(index));
}

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
};

export type ForecastDay = {
  date: string;
  recs: Recommendation[];
};

export type HomeData = {
  days: ForecastDay[];
  neighborhood: Recommendation[];
};

export type SimpleChoice = {
  id: string;
  title: string;
  when: string;
  go: boolean;
  reason: string;
};

const SPARE_OK_WATTS = 2000;

function localIso(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function timeoutSignal(ms: number) {
  const AbortTimeout = (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout;
  if (typeof AbortTimeout === "function") return AbortTimeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function fetchJson(url: string, timeoutMs = 20000) {
  const res = await fetch(url, { signal: timeoutSignal(timeoutMs) });
  if (!res.ok) throw new Error("Could not load the forecast.");
  return res.json();
}

export function dateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function weekDates(from = new Date(), count = 7) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return localIso(d);
  });
}

function asRecs(value: unknown): Recommendation[] {
  return Array.isArray(value) ? value : [];
}

async function fetchWeekFrom(base: string, dates: string[]): Promise<ForecastDay[]> {
  try {
    const week = await fetchJson(
      `${base}/individual/forecast-week?start_date=${dates[0]}&days=${dates.length}`,
      45000,
    );
    const rows = Array.isArray(week?.days) ? week.days : [];
    if (rows.length >= dates.length) {
      return dates.map((date, i) => ({
        date,
        recs: asRecs(rows[i]?.recommendations ?? rows[i]?.recs),
      }));
    }
  } catch {
    // Fall back to the original one-day forecast route.
  }

  const recsByDate = await Promise.all(
    dates.map((date) => fetchJson(`${base}/individual/forecast?target_date=${date}`)),
  );
  return dates.map((date, i) => ({ date, recs: asRecs(recsByDate[i]) }));
}

async function fetchHomeFrom(base: string): Promise<HomeData> {
  const dates = weekDates();
  const [days, neighborhood] = await Promise.all([
    fetchWeekFrom(base, dates),
    fetchJson(`${base}/neighborhood/best-times`).catch(() => []),
  ]);

  return {
    days,
    neighborhood: Array.isArray(neighborhood) ? neighborhood : [],
  };
}

export async function fetchHome(): Promise<HomeData> {
  let lastError: unknown;
  for (const base of await candidateBases()) {
    try {
      const data = await fetchHomeFrom(base);
      await setStoredApiBase(base);
      await cacheHomeData(data);
      return data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not load the forecast.");
}

export function pickWasher(recs: Recommendation[]) {
  return recs.find((r) => r.appliance.includes("washing")) ?? recs[0];
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
      title: "Neighbourhood shared washer or dryer",
      when: `${laundry.window.start}–${laundry.window.end}`,
      go,
      reason: go
        ? "Yes — spare neighbourhood sun. A good time for the shared laundry room."
        : "Wait — the neighbourhood does not have enough spare sun for laundry yet.",
    });
  }

  if (ev?.window) {
    const go = ev.window.avg_value >= SPARE_OK_WATTS;
    choices.push({
      id: "ev",
      title: "Neighbourhood shared EV charger",
      when: `${ev.window.start}–${ev.window.end}`,
      go,
      reason: go
        ? "Yes — spare neighbourhood sun. A good time to use the shared charger."
        : "Wait — better to leave the shared charger for a sunnier slot.",
    });
  }

  return choices;
}

/** Timeline is always 6 AM–9 PM (15 hours). Width maps 1:1 to minutes. */
const BAR_HOURS = 15;
const BAR_MINUTES = BAR_HOURS * 60;

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hourToBarPct(hhmm: string): number {
  return Math.min(100, Math.max(0, ((hhmmToMinutes(hhmm) - 6 * 60) / BAR_MINUTES) * 100));
}

export function abundanceFromRecs(recs: Recommendation[]) {
  const window = recs.find((r) => r.appliance.includes("washing"))?.window;
  if (!window?.start || !window?.end) {
    return { left: 40, width: (30 / BAR_MINUTES) * 100 };
  }
  const left = hourToBarPct(window.start);
  const width = Math.max(
    0,
    ((hhmmToMinutes(window.end) - hhmmToMinutes(window.start)) / BAR_MINUTES) * 100,
  );
  return { left, width };
}

export function nowBarPct(date = new Date()): number {
  const hour = date.getHours() + date.getMinutes() / 60;
  return Math.min(100, Math.max(0, ((hour - 6) / 15) * 100));
}
