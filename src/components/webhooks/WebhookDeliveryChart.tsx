"use client";

import { useMemo } from "react";

import type { WebhookDelivery } from "@/types/webhook";

interface Props {
  deliveries: WebhookDelivery[];
}

/**
 * Charts HTTP response status codes (2xx/4xx/5xx) as bars and the average
 * response latency as a line, derived from delivery records.
 */
export function WebhookDeliveryChart({ deliveries }: Props) {
  const { buckets, avgLatencyMs } = useMemo(() => {
    const buckets = { "2xx": 0, "4xx": 0, "5xx": 0 };
    let latencySum = 0;
    let latencyCount = 0;

    for (const d of deliveries) {
      const code = d.response_code ?? 0;
      if (code >= 200 && code < 300) buckets["2xx"] += 1;
      else if (code >= 400 && code < 500) buckets["4xx"] += 1;
      else if (code >= 500) buckets["5xx"] += 1;

      const latency = (d as WebhookDelivery & { latency_ms?: number }).latency_ms;
      if (typeof latency === "number") {
        latencySum += latency;
        latencyCount += 1;
      }
    }

    return {
      buckets,
      avgLatencyMs: latencyCount === 0 ? null : latencySum / latencyCount,
    };
  }, [deliveries]);

  const max = Math.max(1, ...Object.values(buckets));

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Delivery analytics
        </h3>
        <span className="text-xs text-gray-500">
          {avgLatencyMs === null
            ? "Avg latency: n/a"
            : `Avg latency: ${Math.round(avgLatencyMs)}ms`}
        </span>
      </div>

      <svg
        width={240}
        height={80}
        role="img"
        aria-label="Webhook delivery status code bar chart"
      >
        <title>Webhook delivery status codes</title>
        {(["2xx", "4xx", "5xx"] as const).map((key, i) => {
          const barHeight = Math.max(2, (buckets[key] / max) * 64);
          const x = i * 72 + 12;
          const color =
            key === "2xx"
              ? "text-green-600"
              : key === "4xx"
                ? "text-amber-500"
                : "text-red-600";
          return (
            <g key={key}>
              <rect
                x={x}
                y={68 - barHeight}
                width={40}
                height={barHeight}
                fill="currentColor"
                className={color}
              />
              <text
                x={x + 20}
                y={78}
                textAnchor="middle"
                fontSize={9}
                className="fill-gray-400"
              >
                {key} ({buckets[key]})
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
