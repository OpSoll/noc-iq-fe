"use client";

import React, { useEffect, useState } from "react";
import { formatOutageDuration } from "@/lib/outagesDurationAndExport";
import { Clock } from "lucide-react";

interface OutageDurationCounterProps {
  detectedAt: string | Date | null | undefined;
  status?: string;
  className?: string;
}

/**
 * Component that renders a live outage duration counter for active incident cards.
 * Updates every minute (e.g. '2h 15m ongoing').
 * Applies a pulsing red indicator for outages > 4 hours.
 * Closes #471
 */
export function OutageDurationCounter({
  detectedAt,
  status = "open",
  className = "",
}: OutageDurationCounterProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const isResolved = status === "resolved" || status === "closed";

  useEffect(() => {
    if (isResolved || !detectedAt) return;

    // Update every minute (60,000 ms)
    const intervalId = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => clearInterval(intervalId);
  }, [detectedAt, isResolved]);

  if (isResolved || !detectedAt) {
    return null;
  }

  const { text, isOverFourHours } = formatOutageDuration(detectedAt, currentDate);

  return (
    <div
      className={`inline-flex items-center gap-1.5 text-xs font-medium ${
        isOverFourHours ? "text-red-600 font-semibold" : "text-amber-700"
      } ${className}`}
      data-testid="outage-duration-counter"
      data-over-four-hours={isOverFourHours}
      aria-label={`Outage duration: ${text}`}
    >
      {isOverFourHours ? (
        <span
          className="relative flex h-2 w-2"
          data-testid="pulsing-red-indicator"
          aria-label="Critical duration: outage exceeds 4 hours"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600 animate-pulse" />
        </span>
      ) : (
        <Clock className="h-3 w-3 text-amber-600" aria-hidden="true" />
      )}
      <span>{text}</span>
    </div>
  );
}

export default OutageDurationCounter;
