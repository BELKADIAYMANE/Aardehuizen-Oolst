import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { pickWasher, type ForecastDay } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function parseWindowStart(isoDate: string, hhmm: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

export async function syncWindowNotifications(days: ForecastDay[]) {
  if (Platform.OS !== "android") return;

  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return;

  await Notifications.setNotificationChannelAsync("sun-windows", {
    name: "Best sun windows",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 120, 180],
    lightColor: "#3e8965",
  });

  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = Date.now();
  const upcoming = days
    .map((day) => {
      const window = pickWasher(day.recs)?.window;
      if (!window) return null;
      const start = parseWindowStart(day.date, window.start);
      const remindAt = new Date(start.getTime() - 15 * 60 * 1000);
      return {
        start,
        remindAt,
        window,
        pct: Math.round(window.avg_value),
      };
    })
    .filter((item): item is NonNullable<typeof item> => !!item && item.start.getTime() > now)
    .slice(0, 3);

  for (const item of upcoming) {
    const fireAt =
      item.remindAt.getTime() > now + 30_000
        ? item.remindAt
        : new Date(Math.max(now + 15_000, item.start.getTime()));
    if (fireAt.getTime() <= now) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Good time to use your sun",
        body: `Best washing-machine window: ${item.window.start}–${item.window.end} (${item.pct}% from your roof).`,
        sound: "default",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
        channelId: "sun-windows",
      },
    });
  }
}
