import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface RewardChartProps {
  data: { step: number; reward: number }[];
  height?: number;
}

export function RewardChart({ data, height = 120 }: RewardChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRewardGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="step"
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
          axisLine={false}
          tickLine={false}
          domain={[0, 1]}
        />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
            color: "hsl(var(--foreground))",
          }}
          formatter={(value: number) => [value.toFixed(3), "Total Reward"]}
          labelFormatter={(l: number) => `Step ${l}`}
        />
        <Area
          type="monotone"
          dataKey="reward"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#colorRewardGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
