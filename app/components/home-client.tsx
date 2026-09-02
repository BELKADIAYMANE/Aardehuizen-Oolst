"use client";

import { useEffect, useState } from "react";
import EnergyWidget from "@/components/energy-widget";
import { fetchHome, neighbourhoodChoices, type HomeData, type Recommendation } from "@/lib/api";

function formatHomeDetail(rec: Recommendation) {
  const value = rec.window?.avg_value ?? rec.windows?.[0]?.avg_value;
  if (value == null) return "";
  if (rec.window) return `${Math.round(value)}% sun-powered`;
  return `${Math.round(value)}% self-sufficient`;
}

function ApplianceCard({ rec }: { rec: Recommendation }) {
  const when = rec.window
    ? `${rec.window.start}–${rec.window.end}`
    : rec.windows?.[0]
      ? `${rec.windows[0].start}–${rec.windows[0].end}`
      : "";
  return (
    <div className="appliance-card">
      <p className="eyebrow">{rec.appliance}</p>
      <strong>{when || "—"}</strong>
      <small>{formatHomeDetail(rec)}</small>
    </div>
  );
}

function ChoiceCard({
  title,
  when,
  go,
  reason,
}: {
  title: string;
  when: string;
  go: boolean;
  reason: string;
}) {
  return (
    <div className={`choice-card ${go ? "choice-yes" : "choice-wait"}`}>
      <div className="choice-top">
        <p className="eyebrow">{title}</p>
        <span className="choice-pill">{go ? "Yes" : "Wait"}</span>
      </div>
      <strong>{when}</strong>
      <small>{reason}</small>
    </div>
  );
}

export default function HomeClient() {
  const [day, setDay] = useState<"today" | "tomorrow">("today");
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHome()
      .then(setData)
      .catch((err: Error) => setError(err.message));
  }, []);

  const recs = day === "today" ? data?.today ?? [] : data?.tomorrow ?? [];

  return (
    <main className="app-page">
      <header className="app-header">
        <p className="eyebrow">Aardehuizen · Olst</p>
        <h1>When to use your sun</h1>
        <p className="lede">
          Glance at the widget. Run machines in the green band. That is the whole app.
        </p>
      </header>

      <EnergyWidget
        day={day}
        onDayChange={setDay}
        recs={recs}
        loading={!data && !error}
      />

      {error && <p className="app-error">{error} Is the forecast running?</p>}

      {data && (
        <>
          <section className="app-section">
            <h2>{day === "today" ? "Your home today" : "Your home tomorrow"}</h2>
            <div className="appliance-grid">
              {recs.map((rec) => (
                <ApplianceCard key={rec.appliance} rec={rec} />
              ))}
            </div>
          </section>

          {data.neighborhood.length > 0 && (
            <section className="app-section">
              <h2>Neighbourhood</h2>
              <p className="section-lede">Use the shared machines now, or wait? No numbers — just yes or wait.</p>
              <div className="appliance-grid">
                {neighbourhoodChoices(data.neighborhood).map((choice) => (
                  <ChoiceCard key={choice.id} {...choice} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
