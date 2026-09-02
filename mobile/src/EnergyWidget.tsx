import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  abundanceFromRecs,
  dateLabel,
  nowBarPct,
  pickWasher,
  type Recommendation,
} from "./api";

type Props = {
  date: string;
  dayIndex: number;
  dayCount: number;
  onDayChange: (index: number) => void;
  recs: Recommendation[];
  loading?: boolean;
};

function tipFrom(dayIndex: number, recs: Recommendation[], date: string) {
  const window = pickWasher(recs)?.window;
  const pct = window ? Math.round(window.avg_value) : null;
  if (!window) {
    return dayIndex === 0
      ? "Checking when the sun is strongest on your roof…"
      : "This day’s forecast is on its way.";
  }
  if (dayIndex === 0) {
    return `Best time for the washing machine: ${window.start}–${window.end} (${pct}% from your roof).`;
  }
  const weekday = dateLabel(date).split(" ")[0];
  return `On ${weekday}, run the washing machine ${window.start}–${window.end} (${pct}% from your roof).`;
}

export default function EnergyWidget({
  date,
  dayIndex,
  dayCount,
  onDayChange,
  recs,
  loading,
}: Props) {
  const pct = Math.round(pickWasher(recs)?.window?.avg_value ?? 0);
  const abundance = abundanceFromRecs(recs);
  const marker = dayIndex === 0 ? nowBarPct() : abundance.left + abundance.width / 2;

  return (
    <View style={styles.widget}>
      <View style={styles.header}>
        <Text style={styles.title}>{date ? dateLabel(date) : "Olst forecast"}</Text>
        <View style={styles.arrows}>
          <Pressable
            onPress={() => onDayChange(dayIndex - 1)}
            disabled={dayIndex <= 0}
            style={styles.arrowHit}
          >
            <Text style={[styles.arrow, dayIndex <= 0 && styles.arrowOff]}>‹</Text>
          </Pressable>
          <Pressable
            onPress={() => onDayChange(dayIndex + 1)}
            disabled={dayIndex >= dayCount - 1}
            style={styles.arrowHit}
          >
            <Text style={[styles.arrow, dayIndex >= dayCount - 1 && styles.arrowOff]}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.summary}>
        <View style={styles.message}>
          <Text style={styles.eyebrow}>Energy tip</Text>
          <Text style={styles.tip}>
            {loading ? "Loading the Olst forecast…" : tipFrom(dayIndex, recs, date)}
          </Text>
        </View>
        <View style={styles.ring}>
          <Text style={styles.ringPct}>{loading ? "—" : `${pct}%`}</Text>
        </View>
      </View>

      <View style={styles.timeline}>
        <View style={styles.labels}>
          <Text style={styles.label}>6 AM</Text>
          <Text style={[styles.label, styles.peak]}>
            {dayIndex === 0 ? "Solar peak" : "Forecast peak"}
          </Text>
          <Text style={styles.label}>9 PM</Text>
        </View>
        <View style={styles.bar}>
          <View style={styles.daylight} />
          <View
            style={[
              styles.abundance,
              { left: `${abundance.left}%`, width: `${abundance.width}%` },
            ]}
          />
          <View style={[styles.marker, { left: `${marker}%` }]} />
        </View>
        <View style={styles.labels}>
          <Text style={styles.label}>Daylight</Text>
          <Text style={styles.label}>Abundant</Text>
          <Text style={styles.label}>Night</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widget: {
    backgroundColor: "#fffdf7",
    borderColor: "#dce6de",
    borderWidth: 1,
    borderRadius: 24,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  title: { color: "#30443b", fontSize: 13, fontWeight: "700", flex: 1, paddingRight: 8 },
  arrows: { flexDirection: "row" },
  arrowHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  arrow: { fontSize: 28, color: "#30443b", lineHeight: 30 },
  arrowOff: { opacity: 0.25 },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: "#f4f8f2",
    borderTopColor: "#edf1eb",
    borderTopWidth: 1,
    borderBottomColor: "#e7eee7",
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  message: { flex: 1 },
  eyebrow: {
    color: "#2f6f52",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  tip: { color: "#30443b", fontSize: 14, fontWeight: "700", lineHeight: 20 },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 7,
    borderColor: "#3e8965",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4f8f2",
  },
  ringPct: { color: "#20312d", fontSize: 16, fontWeight: "700" },
  timeline: { paddingHorizontal: 20, paddingVertical: 16 },
  labels: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: "#8a9891", fontSize: 10 },
  peak: { color: "#2f6f52", fontWeight: "700" },
  bar: {
    height: 10,
    borderRadius: 5,
    backgroundColor: "#dce7de",
    marginVertical: 10,
    overflow: "visible",
  },
  daylight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 5,
    backgroundColor: "#c5ddd0",
  },
  abundance: {
    position: "absolute",
    top: 0,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3e8965",
  },
  marker: {
    position: "absolute",
    top: -4,
    width: 2,
    height: 18,
    borderRadius: 2,
    backgroundColor: "#30483c",
    marginLeft: -1,
  },
});
