"use client";

// Closes #451: real-time SLA breach countdown timer card for critical open outages

import { useEffect, useMemo, useState, memo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getOutages } from "@/services/outages";
import { useSlaConfig } from "@/hooks/useSlaConfig";
import { queryKeys } from "@/lib/queryKeys";
import {
  buildBreachCountdowns,
  formatCountdown,
  type SeverityThresholdMap,
} from "@/lib/slaBreach";

const OPEN_OUTAGES_PARAMS = { status: "open", severity: "critical", page_size: 50 };
const TICK_MS = 1000;
const OUTAGES_REFETCH_MS = 30_000;

function SLABreachCountdownCard() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const outagesQuery = useQuery({
    queryKey: queryKeys.outages.list(OPEN_OUTAGES_PARAMS),
    queryFn: () => getOutages(OPEN_OUTAGES_PARAMS),
    staleTime: 15_000,
    refetchInterval: OUTAGES_REFETCH_MS,
  });

  const configQuery = useSlaConfig();

  const thresholds: SeverityThresholdMap = useMemo(() => {
    const map: SeverityThresholdMap = {};
    for (const entry of configQuery.data ?? []) {
      map[entry.severity] = { threshold_minutes: entry.threshold_minutes };
    }
    return map;
  }, [configQuery.data]);

  const countdowns = useMemo(
    () => buildBreachCountdowns(outagesQuery.data?.items ?? [], thresholds, now),
    [outagesQuery.data, thresholds, now],
  );

  if (outagesQuery.isLoading || configQuery.isLoading) {
    return (
      <div className="rounded-xl border-l-4 border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs text-slate-400">Checking critical outage SLA timers…</p>
      </div>
    );
  }

  if (outagesQuery.isError || configQuery.isError) {
    return null;
  }

  if (countdowns.length === 0) {
    return (
      <div className="rounded-xl border-l-4 border-green-400 bg-green-50 p-4 shadow-sm">
        <p className="text-sm font-medium text-green-700">
          No open critical outages — no SLA breach risk right now.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-l-4 border-red-400 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-600">
        Critical Outage SLA Breach Countdown
      </h3>
      <div className="flex flex-wrap gap-3">
        {countdowns.map((c) => (
          <div
            key={c.outageId}
            data-testid="breach-countdown-badge"
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              c.isBreached
                ? "border-red-400 bg-red-50 text-red-700"
                : c.isWarning
                  ? "animate-pulse border-amber-400 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
            title={`${c.siteName} — detected ${new Date(c.detectedAt).toLocaleString()}`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                c.isBreached ? "bg-red-500" : c.isWarning ? "bg-amber-500" : "bg-slate-400"
              }`}
            />
            <span>{c.siteName}</span>
            <span className="font-mono">{formatCountdown(c.minutesRemaining)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(SLABreachCountdownCard);
