'use client';

import { useMemo } from 'react';

import {
  aggregateLatencyByDay,
  buildLatencyPlot,
  LATENCY_SPIKE_THRESHOLD_MS,
  summarizeLatency,
  toLatencyWindow,
  toPolylinePoints,
} from '@/lib/webhookLatency';
import type { WebhookDelivery } from '@/types/webhook';
import { cn } from '@/lib/utils';

/**
 * Daily average webhook delivery latency over the past week.
 *
 * The threshold line and the amber spike markers are the point of the chart: a
 * flat line well under 1,000 ms is a healthy receiver, whereas a line that
 * crosses the threshold tells an operator their endpoint — not the platform —
 * is the slow part.
 *
 * Closes #673 — delivery latency performance line chart.
 */

export interface WebhookLatencyChartProps {
  /** Dispatches to aggregate; those without a recorded latency are ignored. */
  deliveries: WebhookDelivery[];
  /** Days shown in the window. */
  days?: number;
  thresholdMs?: number;
  className?: string;
}

export default function WebhookLatencyChart({
  deliveries,
  days = 7,
  thresholdMs = LATENCY_SPIKE_THRESHOLD_MS,
  className,
}: WebhookLatencyChartProps) {
  const samples = useMemo(
    () => toLatencyWindow(aggregateLatencyByDay(deliveries, { thresholdMs }), days),
    [deliveries, days, thresholdMs]
  );

  const plot = useMemo(
    () => buildLatencyPlot(samples, { thresholdMs }),
    [samples, thresholdMs]
  );

  if (samples.length === 0) {
    return (
      <div
        data-testid="webhook-latency-chart-empty"
        className={cn(
          'rounded-lg border border-slate-200 p-4 text-sm text-slate-400',
          className
        )}
      >
        No delivery latency recorded yet.
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-lg border border-slate-200 p-4', className)}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Delivery latency
        </h3>
        <span className="text-xs text-slate-500">
          avg per day, last {samples.length} day{samples.length === 1 ? '' : 's'}
        </span>
      </div>

      <svg
        width={plot.width}
        height={plot.height}
        viewBox={`0 0 ${plot.width} ${plot.height}`}
        role="img"
        data-testid="webhook-latency-chart"
        aria-label={`Webhook delivery latency: ${summarizeLatency(samples)}`}
        className="w-full"
      >
        <title>Average webhook delivery latency per day</title>
        <desc>{summarizeLatency(samples)}</desc>

        {/* Spike threshold, drawn beneath the data so it never obscures it. */}
        <line
          data-testid="latency-threshold-line"
          x1={16}
          x2={plot.width - 16}
          y1={plot.thresholdY}
          y2={plot.thresholdY}
          stroke="currentColor"
          className="text-amber-500"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <text
          x={plot.width - 18}
          y={plot.thresholdY - 4}
          textAnchor="end"
          fontSize={9}
          className="fill-amber-600"
        >
          {thresholdMs}ms threshold
        </text>

        <polyline
          data-testid="latency-line"
          points={toPolylinePoints(plot)}
          fill="none"
          stroke="currentColor"
          className="text-indigo-600"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {plot.points.map(({ x, y, sample }) => (
          <g key={sample.date}>
            <circle
              data-testid={sample.isSpike ? 'latency-spike-point' : 'latency-point'}
              cx={x}
              cy={y}
              r={sample.isSpike ? 5 : 3}
              fill="currentColor"
              className={sample.isSpike ? 'text-amber-500' : 'text-indigo-600'}
            />
            <title>
              {sample.date}: {sample.averageMs}ms average, {sample.count} dispatch
              {sample.count === 1 ? '' : 'es'}
            </title>
          </g>
        ))}
      </svg>

      <table className="sr-only">
        <caption>Average webhook delivery latency per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Average latency (ms)</th>
            <th scope="col">p95 latency (ms)</th>
            <th scope="col">Dispatches</th>
          </tr>
        </thead>
        <tbody data-testid="latency-data-table">
          {samples.map((sample) => (
            <tr key={sample.date}>
              <th scope="row">{sample.date}</th>
              <td>{sample.averageMs}</td>
              <td>{sample.p95Ms}</td>
              <td>{sample.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
