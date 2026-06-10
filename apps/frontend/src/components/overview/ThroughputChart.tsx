import dayjs from "@bullstudio/dayjs";
import type { OverviewMetricsResponse } from "@bullstudio/private-router";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bullstudio/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@bullstudio/ui/components/chart";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { MetricsFallbackNotice } from "./MetricsFallbackNotice";

type TimeSeriesDataPoint = OverviewMetricsResponse["timeSeries"][number];

type ThroughputChartProps = {
  data: TimeSeriesDataPoint[];
  timeRange: number;
  nativeMetrics: OverviewMetricsResponse["nativeMetrics"];
};

const chartConfig: ChartConfig = {
  completed: {
    label: "Completed",
    color: "hsl(142, 76%, 36%)",
  },
  failed: {
    label: "Failed",
    color: "hsl(0, 84%, 60%)",
  },
};

export function ThroughputChart({
  data,
  timeRange,
  nativeMetrics,
}: ThroughputChartProps) {
  const formattedData = data.map((point) => ({
    ...point,
    time: dayjs(point.timestamp).format(timeRange <= 24 ? "HH:mm" : "MMM D"),
  }));

  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle>Job Throughput</CardTitle>
        <CardDescription>
          Completed vs failed jobs over the last {timeRange}h
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          <LineChart data={formattedData} accessibilityLayer>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              dataKey="completed"
              type="monotone"
              stroke="var(--color-completed)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              dataKey="failed"
              type="monotone"
              stroke="var(--color-failed)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
        <MetricsFallbackNotice nativeMetrics={nativeMetrics} className="mt-3" />
      </CardContent>
    </Card>
  );
}
