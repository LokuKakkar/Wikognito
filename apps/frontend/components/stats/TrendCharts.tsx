"use client";

import type { TrendPoint } from "@redactle/shared";

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const width = 240;
  const height = 64;
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - (value / max) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <figure>
      <figcaption className="muted">{label}</figcaption>
      <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
      </svg>
    </figure>
  );
}

export function TrendCharts({ trends }: { trends: TrendPoint[] }) {
  if (trends.length === 0) return null;
  return (
    <section>
      <h2>Trends</h2>
      <Sparkline
        values={trends.map((point) => point.averageGuesses ?? 0)}
        label="Average guesses"
      />
      <Sparkline
        values={trends.map((point) => (point.averageCompletionTimeMs ?? 0) / 1000)}
        label="Average completion time"
      />
      <Sparkline values={trends.map((point) => point.winRate * 100)} label="Win rate" />
    </section>
  );
}
