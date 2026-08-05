import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import type { RunStreams } from "@running-club/shared";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatDurationClock, formatPace } from "@/lib/format";

const chartConfig = {
  pace: { label: "Pace", color: "var(--rc-lane)" },
  hr: { label: "Heart rate", color: "var(--rc-sky)" },
} satisfies ChartConfig;

export function RunStreamsChart({ streams }: { streams: RunStreams }) {
  const hasHr = streams.hr.some((value) => value != null);
  const data = useMemo(
    () =>
      streams.t.map((t, index) => ({
        t,
        pace: streams.pace[index],
        hr: streams.hr[index],
      })),
    [streams],
  );

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-primary uppercase">
        Pace & heart rate
      </h2>
      <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={28}
            tickFormatter={(value) => formatDurationClock(Number(value))}
          />
          <YAxis
            yAxisId="pace"
            reversed
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(value) =>
              formatPace(Number(value)).replace("/km", "")
            }
          />
          {hasHr ? (
            <YAxis
              yAxisId="hr"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={36}
            />
          ) : null}
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(_, payload) => {
                  const t = Number(payload?.[0]?.payload?.t ?? 0);
                  return formatDurationClock(t);
                }}
                formatter={(value, name) => (
                  <span className="font-medium tabular-nums text-foreground">
                    {name === "pace"
                      ? formatPace(Number(value))
                      : `${Math.round(Number(value))} bpm`}
                  </span>
                )}
              />
            }
          />
          <Line
            yAxisId="pace"
            type="monotone"
            dataKey="pace"
            stroke="var(--color-pace)"
            strokeWidth={2}
            dot={false}
          />
          {hasHr ? (
            <Line
              yAxisId="hr"
              type="monotone"
              dataKey="hr"
              stroke="var(--color-hr)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          ) : null}
        </LineChart>
      </ChartContainer>
    </div>
  );
}
