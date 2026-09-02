"use no memo";
import React from "react";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { DayForecast, NeighbourhoodLine, WidgetSnapshot } from "./widgetSnapshot";

function Timeline({ day }: { day: DayForecast }) {
  const left = Math.max(day.bandLeft, 0);
  const width = Math.max(day.bandWidth, 0.5);
  const right = Math.max(100 - left - width, 0);
  return (
    <FlexWidget
      style={{
        flexDirection: "row",
        height: 8,
        width: "match_parent",
        borderRadius: 4,
        overflow: "hidden",
        backgroundColor: "#c5ddd0",
        marginTop: 6,
      }}
    >
      <FlexWidget style={{ flex: left, height: 8 }} />
      <FlexWidget style={{ flex: width, height: 8, backgroundColor: "#3e8965" }} />
      <FlexWidget style={{ flex: right, height: 8 }} />
    </FlexWidget>
  );
}

function Arrow({
  label,
  action,
  enabled,
}: {
  label: string;
  action: string;
  enabled: boolean;
}) {
  return (
    <FlexWidget
      clickAction={enabled ? action : undefined}
      style={{
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TextWidget
        text={label}
        style={{
          color: enabled ? "#30443b" : "#c5cfc9",
          fontSize: 30,
          fontWeight: "700",
        }}
      />
    </FlexWidget>
  );
}

function NeighbourhoodRow({ line }: { line: NeighbourhoodLine }) {
  const yes = line.go === true;
  const unknown = line.go == null;
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: "match_parent",
        backgroundColor: unknown ? "#fffdf7" : yes ? "#f4faf4" : "#fff8e8",
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginTop: 6,
      }}
    >
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          width: "match_parent",
        }}
      >
        <TextWidget
          text={line.title}
          maxLines={1}
          truncate="END"
          style={{ color: "#4a5c54", fontSize: 11, fontWeight: "700" }}
        />
        <TextWidget
          text={unknown ? "—" : yes ? "Yes" : "Wait"}
          style={{
            color: unknown ? "#85928d" : yes ? "#3e8965" : "#c4922a",
            fontSize: 13,
            fontWeight: "700",
          }}
        />
      </FlexWidget>
      <TextWidget
        text={line.detail}
        maxLines={2}
        truncate="END"
        style={{ color: "#4a5c54", fontSize: 11, marginTop: 2 }}
      />
    </FlexWidget>
  );
}

export function HomeWidget({ data }: { data: WidgetSnapshot }) {
  const canPrev = data.dayIndex > 0;
  const canNext = data.dayIndex < data.dayCount - 1;
  const day = data.day;

  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: "#eef3ee",
        borderRadius: 24,
        padding: 10,
        flexDirection: "column",
      }}
    >
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          width: "match_parent",
        }}
      >
        <TextWidget
          clickAction="OPEN_APP"
          text="When to use your sun"
          style={{ color: "#30443b", fontSize: 13, fontWeight: "700" }}
        />
        <TextWidget
          text="Zonwijzer"
          style={{ color: "#85928d", fontSize: 11, fontWeight: "700" }}
        />
      </FlexWidget>

      <FlexWidget
        style={{
          width: "match_parent",
          backgroundColor: "#fffdf7",
          borderRadius: 16,
          borderColor: "#dce6de",
          borderWidth: 1,
          marginTop: 8,
          overflow: "hidden",
        }}
      >
        <FlexWidget
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            width: "match_parent",
            paddingHorizontal: 4,
            paddingTop: 4,
          }}
        >
          <Arrow label="‹" action="DAY_PREV" enabled={canPrev} />
          <FlexWidget clickAction="OPEN_APP" style={{ flex: 1, alignItems: "center" }}>
            <TextWidget
              text={day.title}
              maxLines={1}
              truncate="END"
              style={{ color: "#30443b", fontSize: 13, fontWeight: "700" }}
            />
          </FlexWidget>
          <Arrow label="›" action="DAY_NEXT" enabled={canNext} />
        </FlexWidget>

        <FlexWidget
          clickAction="OPEN_APP"
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "match_parent",
            backgroundColor: "#f4f8f2",
            paddingHorizontal: 10,
            paddingVertical: 8,
          }}
        >
          <FlexWidget style={{ flex: 1, marginRight: 8 }}>
            <TextWidget
              text="ENERGY TIP"
              style={{
                color: "#2f6f52",
                fontSize: 9,
                fontWeight: "700",
                letterSpacing: 1,
              }}
            />
            <TextWidget
              text={day.tip}
              maxLines={2}
              truncate="END"
              style={{
                color: "#30443b",
                fontSize: 12,
                fontWeight: "700",
                marginTop: 2,
              }}
            />
          </FlexWidget>
          <FlexWidget
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              borderWidth: 5,
              borderColor: "#3e8965",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#f4f8f2",
            }}
          >
            <TextWidget
              text={`${day.pct}%`}
              style={{ color: "#20312d", fontSize: 12, fontWeight: "700" }}
            />
          </FlexWidget>
        </FlexWidget>

        <FlexWidget
          clickAction="OPEN_APP"
          style={{ paddingHorizontal: 10, paddingVertical: 8, width: "match_parent" }}
        >
          <FlexWidget
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "match_parent",
            }}
          >
            <TextWidget text="6 AM" style={{ color: "#8a9891", fontSize: 9 }} />
            <TextWidget
              text={day.peakLabel}
              style={{ color: "#2f6f52", fontSize: 9, fontWeight: "700" }}
            />
            <TextWidget text="9 PM" style={{ color: "#8a9891", fontSize: 9 }} />
          </FlexWidget>
          <Timeline day={day} />
          <FlexWidget
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              width: "match_parent",
              marginTop: 4,
            }}
          >
            <TextWidget text="Daylight" style={{ color: "#8a9891", fontSize: 9 }} />
            <TextWidget text="Abundant" style={{ color: "#8a9891", fontSize: 9 }} />
            <TextWidget text="Night" style={{ color: "#8a9891", fontSize: 9 }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      <TextWidget
        text="Neighbourhood shared machines"
        style={{ color: "#30443b", fontSize: 11, fontWeight: "700", marginTop: 8 }}
      />
      <NeighbourhoodRow line={data.laundry} />
      <NeighbourhoodRow line={data.ev} />
    </FlexWidget>
  );
}
