import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { HomeWidget } from "./HomeWidget";
import type { WidgetSnapshot } from "./widgetSnapshot";

export async function pushHomeWidget(data: WidgetSnapshot) {
  if (Platform.OS !== "android") return;
  await requestWidgetUpdate({
    widgetName: "Aardehuizen",
    renderWidget: () => <HomeWidget data={data} />,
  });
}
