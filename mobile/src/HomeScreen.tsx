import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  fetchHome,
  neighbourhoodChoices,
  setWidgetDayIndex,
  type HomeData,
  type Recommendation,
  type SimpleChoice,
} from "./api";
import EnergyWidget from "./EnergyWidget";
import { syncWindowNotifications } from "./notifications";
import { pushHomeWidget } from "./pushWidget";
import { nextBestDayIndex, snapshotFromHome } from "./widgetSnapshot";

function whenOf(rec: Recommendation) {
  if (rec.window) return `${rec.window.start}–${rec.window.end}`;
  if (rec.windows?.[0]) return `${rec.windows[0].start}–${rec.windows[0].end}`;
  return "—";
}

function detailOf(rec: Recommendation) {
  const value = rec.window?.avg_value ?? rec.windows?.[0]?.avg_value;
  if (value == null) return "";
  if (rec.window) return `${Math.round(value)}% from your roof`;
  return `${Math.round(value)}% self-sufficient`;
}

function ChoiceCard({ choice }: { choice: SimpleChoice }) {
  return (
    <View style={[styles.card, choice.go ? styles.yes : styles.wait]}>
      <View style={styles.choiceTop}>
        <Text style={styles.eyebrow}>{choice.title}</Text>
        <View style={[styles.pill, choice.go ? styles.pillYes : styles.pillWait]}>
          <Text style={styles.pillText}>{choice.go ? "Yes" : "Wait"}</Text>
        </View>
      </View>
      <Text style={styles.when}>{choice.when}</Text>
      <Text style={styles.reason}>{choice.reason}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const [dayIndex, setDayIndex] = useState(0);
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const home = await fetchHome();
      const startDay = nextBestDayIndex(home);
      setData(home);
      setDayIndex(startDay);
      void setWidgetDayIndex(startDay);
      void pushHomeWidget(snapshotFromHome(home, startDay));
      void syncWindowNotifications(home.days);
    } catch {
      setError(
        "Could not reach the forecast. Keep the laptop API running on port 8001, then try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const selected = data?.days[dayIndex];
  const recs = selected?.recs ?? [];
  const dayCount = data?.days.length || 7;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Aardehuizen · Olst</Text>
      <Text style={styles.h1}>When to use your sun</Text>
      <Text style={styles.lede}>
        Run machines in the green band. Swipe the arrows for the next seven days,
        and add the Zonwijzer widget to your home screen.
      </Text>

      <EnergyWidget
        date={selected?.date ?? ""}
        dayIndex={dayIndex}
        dayCount={dayCount}
        onDayChange={setDayIndex}
        recs={recs}
        loading={loading && !data}
      />

      {loading && !data && (
        <ActivityIndicator style={{ marginTop: 24 }} color="#3e8965" />
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={load} style={styles.save}>
            <Text style={styles.saveText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {data && (
        <>
          <Text style={styles.h2}>Your home this day</Text>
          {recs.map((rec) => (
            <View key={rec.appliance} style={styles.card}>
              <Text style={styles.eyebrow}>{rec.appliance}</Text>
              <Text style={styles.when}>{whenOf(rec)}</Text>
              <Text style={styles.reason}>{detailOf(rec)}</Text>
            </View>
          ))}

          <Text style={styles.h2}>Neighbourhood</Text>
          <Text style={styles.sectionLede}>
            Shared laundry and the shared EV charger. Yes or wait — no kW.
          </Text>
          {neighbourhoodChoices(data.neighborhood).map((choice) => (
            <ChoiceCard key={choice.id} choice={choice} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#eef3ee" },
  content: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 40 },
  kicker: {
    color: "#85928d",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  h1: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 28,
    fontWeight: "700",
    color: "#20312d",
    letterSpacing: -0.5,
  },
  lede: { color: "#71817b", fontSize: 15, lineHeight: 21, marginBottom: 16 },
  h2: {
    marginTop: 22,
    marginBottom: 6,
    fontSize: 15,
    fontWeight: "700",
    color: "#30443b",
  },
  sectionLede: {
    color: "#71817b",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fffdf7",
    borderColor: "#dce6de",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  yes: { backgroundColor: "#f4faf4", borderColor: "#b8d7c4" },
  wait: { backgroundColor: "#fff8e8", borderColor: "#ead9a8" },
  choiceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: "#85928d",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    flex: 1,
    paddingRight: 8,
  },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillYes: { backgroundColor: "#3e8965" },
  pillWait: { backgroundColor: "#c4922a" },
  pillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  when: { marginTop: 6, fontSize: 20, fontWeight: "700", color: "#20312d" },
  reason: { marginTop: 4, color: "#4a5c54", fontSize: 13, lineHeight: 18 },
  errorBox: { marginTop: 14 },
  error: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff3d6",
    color: "#9b6d1d",
    fontSize: 14,
  },
  save: {
    marginTop: 8,
    backgroundColor: "#3e8965",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
