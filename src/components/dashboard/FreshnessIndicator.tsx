"use client";

import React, { useMemo, useState, useEffect } from "react";

interface FreshnessIndicatorProps {
  lastUpdated: string | Date;
}

const FRESH_MS = 5 * 60 * 1000;
const STALE_MS = 30 * 60 * 1000;

function classifyAge(ageMs: number): { label: string; color: string } {
  if (ageMs < FRESH_MS) {
    return { label: "Fresh", color: "bg-green-100 text-green-800" };
  }
  if (ageMs < STALE_MS) {
    return { label: "Stale", color: "bg-yellow-100 text-yellow-800" };
  }
  return { label: "Expired", color: "bg-red-100 text-red-800" };
}

function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function FreshnessIndicator({ lastUpdated }: FreshnessIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const ageMs = useMemo(() => {
    const updated = typeof lastUpdated === "string" ? new Date(lastUpdated) : lastUpdated;
    return now - updated.getTime();
  }, [lastUpdated, now]);

  const { label, color } = classifyAge(ageMs);

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {label}
      <span className="opacity-60">{formatAge(ageMs)}</span>
    </span>
  );
}
