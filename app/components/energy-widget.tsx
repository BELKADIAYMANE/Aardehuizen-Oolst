"use client";

import { useMemo } from "react";
import { BatteryCharging, ChevronLeft, ChevronRight, SunMedium } from "lucide-react";
import {
  type Recommendation,
  hourToBarPct,
  nowBarPct,
  pickWasher,
} from "@/lib/api";

const DAY_START = 6;
const DAY_END = 21;

type Props = {
  day: "today" | "tomorrow";
  onDayChange: (day: "today" | "tomorrow") => void;
  recs: Recommendation[];
  loading?: boolean;
};

function clockLabel(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function abundanceFrom(recs: Recommendation[]) {
  const window = recs.find((r) => r.appliance.includes("washing"))?.window;
  if (!window) return { left: 40, width: (30 / 900) * 100, label: "midday" };
  return {
    left: hourToBarPct(window.start),
    width: Math.max(0, ((minutesOf(window.end) - minutesOf(window.start)) / 900) * 100),
    label: `${window.start}–${window.end}`,
  };
}

function tipFrom(day: "today" | "tomorrow", recs: Recommendation[]) {
  const washer = pickWasher(recs);
  const window = washer?.window;
  const pct = window ? Math.round(window.avg_value) : null;
  if (!window) {
    return day === "today"
      ? "Checking when the sun is strongest on your roof…"
      : "Tomorrow’s forecast is on its way.";
  }
  if (day === "tomorrow") {
    return `Tomorrow, run the washing machine around ${window.start} (${pct}% sun-powered).`;
  }
  const now = new Date();
  const [sh, sm] = window.start.split(":").map(Number);
  const [eh, em] = window.end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin >= startMin && nowMin <= endMin + 60) {
    return `Good time to use the washing machine — about ${pct}% from your own roof.`;
  }
  if (nowMin < startMin) {
    return `Best time for the washing machine: ${window.start}–${window.end} (${pct}% sun-powered).`;
  }
  return `Today’s best window was ${window.start}. Check tomorrow in the widget.`;
}

export function EnergyWidget({ day, onDayChange, recs, loading }: Props) {
  const washer = pickWasher(recs);
  const pct = Math.round(washer?.window?.avg_value ?? 0);
  const abundance = useMemo(() => abundanceFrom(recs), [recs]);
  const marker = day === "today" ? nowBarPct() : abundance.left + abundance.width / 2;
  const formattedDate = clockLabel();

  return (
    <section className="energy-widget" aria-label="Household energy overview">
      <header className="widget-header">
        <div className="widget-title date-button flex items-center gap-2">
          {day === "today" ? formattedDate : "Tomorrow forecast"}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={day === "today"}
              onClick={() => onDayChange("today")}
              className="rounded-full p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 disabled:opacity-30"
              aria-label="Today"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              disabled={day === "tomorrow"}
              onClick={() => onDayChange("tomorrow")}
              className="rounded-full p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100 disabled:opacity-30"
              aria-label="Tomorrow forecast"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </header>

      <div className="energy-summary">
        <div className="energy-message">
          <div>
            <p className="eyebrow">Energy tip</p>
            <strong>{loading ? "Loading the Olst forecast…" : tipFrom(day, recs)}</strong>
          </div>
        </div>
        {day === "today" ? (
          <div
            className="battery-ring"
            style={{
              background: `conic-gradient(#3e8965 0 ${pct}%, #d9e9dd ${pct}% 100%)`,
            }}
            aria-label={`${pct} percent sun-powered`}
          >
            <div className="ring-inner">
              <BatteryCharging size={18} />
              <strong>{loading ? "—" : `${pct}%`}</strong>
            </div>
          </div>
        ) : (
          <div className="weather-mark" aria-label="Solar forecast">
            <SunMedium size={56} />
          </div>
        )}
      </div>

      <div
        className="energy-timeline"
        aria-label={`${day === "today" ? "Today's" : "Tomorrow's"} solar energy timeline`}
      >
        <div className="timeline-labels">
          <span>6 AM</span>
          <span>{day === "today" ? "Solar peak" : "Forecast peak"}</span>
          <span>9 PM</span>
        </div>
        <div
          className="timeline-bar"
          role="img"
          aria-label={`Best solar window ${abundance.label}, daylight from ${DAY_START}:00 to ${DAY_END}:00`}
        >
          <span className="timeline-daylight" />
          <span
            className="timeline-abundance"
            style={{ left: `${abundance.left}%`, width: `${abundance.width}%` }}
          />
          <span className="timeline-marker" style={{ left: `${marker}%` }} aria-hidden="true" />
        </div>
        <div className="timeline-legend">
          <span>
            <i className="legend-dot daylight" />
            Daylight
          </span>
          <span>
            <i className="legend-dot abundant" />
            Abundant
          </span>
          <span>
            <i className="legend-dot night" />
            Night
          </span>
        </div>
      </div>
    </section>
  );
}

export default EnergyWidget;
