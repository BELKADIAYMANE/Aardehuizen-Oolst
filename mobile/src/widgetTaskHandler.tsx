import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import {
  fetchHome,
  getCachedHomeData,
  getWidgetDayIndex,
  setWidgetDayIndex,
  type HomeData,
} from "./api";
import { HomeWidget } from "./HomeWidget";
import {
  clampDayIndex,
  emptySnapshot,
  nextBestDayIndex,
  snapshotFromHome,
} from "./widgetSnapshot";

function show(props: WidgetTaskHandlerProps, data: HomeData, dayIndex: number) {
  props.renderWidget(<HomeWidget data={snapshotFromHome(data, dayIndex)} />);
}

async function loadHome() {
  try {
    return await fetchHome();
  } catch {
    return getCachedHomeData();
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetAction === "WIDGET_DELETED") return;

  if (props.widgetAction === "WIDGET_CLICK") {
    const step = props.clickAction === "DAY_NEXT" ? 1 : props.clickAction === "DAY_PREV" ? -1 : 0;
    if (step !== 0) {
      const home = (await getCachedHomeData()) ?? (await loadHome());
      if (!home) {
        props.renderWidget(<HomeWidget data={emptySnapshot("Open the app to refresh.")} />);
        return;
      }
      const next = clampDayIndex((await getWidgetDayIndex()) + step, home.days.length);
      await setWidgetDayIndex(next);
      show(props, home, next);
      return;
    }
  }

  const home = await loadHome();
  if (!home) {
    props.renderWidget(
      <HomeWidget data={emptySnapshot("Open the app on the emulator to refresh.")} />,
    );
    return;
  }

  const preferred =
    props.widgetAction === "WIDGET_ADDED"
      ? nextBestDayIndex(home)
      : clampDayIndex(await getWidgetDayIndex(), home.days.length);
  await setWidgetDayIndex(preferred);
  show(props, home, preferred);
}
