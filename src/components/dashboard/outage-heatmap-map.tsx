"use client";

import React, { useMemo, useState } from "react";

export type OutageSeverity = "critical" | "major" | "minor" | "healthy";

export interface SiteOutageMetric {
  id: string;
  siteName: string;
  region: string;
  coordinates: {
    lon: number;
    lat: number;
  };
  severity: OutageSeverity;
  activeIncidents: number;
  packetLossPct: number;
  latencyMs: number;
  uptimePct: number;
  lastUpdated: string;
}

interface OutageHeatmapMapProps {
  sites: SiteOutageMetric[];
  /** Optional SVG map paths representing continents/regions in a 1000x500 viewBox */
  mapPaths?: string[];
  onSelectSite?: (site: SiteOutageMetric) => void;
  className?: string;
}

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 500;

const SEVERITY_META: Record<
  OutageSeverity,
  {
    label: string;
    color: string;
    haloColor: string;
    badgeClasses: string;
  }
> = {
  critical: {
    label: "Critical",
    color: "#ef4444",
    haloColor: "rgba(239, 68, 68, 0.35)",
    badgeClasses: "bg-red-500/15 text-red-400 border-red-500/30",
  },
  major: {
    label: "Major",
    color: "#f97316",
    haloColor: "rgba(249, 115, 22, 0.32)",
    badgeClasses: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  },
  minor: {
    label: "Minor",
    color: "#eab308",
    haloColor: "rgba(234, 179, 8, 0.28)",
    badgeClasses: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  },
  healthy: {
    label: "Healthy",
    color: "#22c55e",
    haloColor: "rgba(34, 197, 94, 0.22)",
    badgeClasses: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  },
};

function toSvgCoords(lon: number, lat: number) {
  const x = ((lon + 180) / 360) * VIEWBOX_WIDTH;
  const y = ((90 - lat) / 180) * VIEWBOX_HEIGHT;
  return { x, y };
}

export function OutageHeatmapMap({
  sites,
  mapPaths = [],
  onSelectSite,
  className = "",
}: OutageHeatmapMapProps) {
  const [hoveredSite, setHoveredSite] = useState<SiteOutageMetric | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const projectedSites = useMemo(
    () =>
      sites.map((site) => ({
        site,
        ...toSvgCoords(site.coordinates.lon, site.coordinates.lat),
      })),
    [sites]
  );

  const handleMarkerEnter = (
    e: React.SyntheticEvent<SVGGElement>,
    site: SiteOutageMetric
  ) => {
    const containerRect =
      e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if ("clientX" in e && containerRect) {
      const mouseEvent = e as React.MouseEvent<SVGGElement>;
      setPointerPos({
        x: mouseEvent.clientX - containerRect.left,
        y: mouseEvent.clientY - containerRect.top,
      });
    }
    setHoveredSite(site);
  };

  const handleMarkerMove = (
    e: React.MouseEvent<SVGGElement>,
    site: SiteOutageMetric
  ) => {
    const containerRect =
      e.currentTarget.ownerSVGElement?.parentElement?.getBoundingClientRect();
    if (!containerRect) return;
    setPointerPos({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
    });
    if (hoveredSite?.id !== site.id) {
      setHoveredSite(site);
    }
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 ${className}`}
      onMouseLeave={() => setHoveredSite(null)}
    >
      {/* Top Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 px-4 py-2.5 text-xs text-slate-300">
        <span className="font-medium text-slate-200">
          Regional Site Outage Heatmap
        </span>
        <div className="flex items-center gap-4">
          {(Object.keys(SEVERITY_META) as OutageSeverity[]).map((sev) => (
            <span key={sev} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SEVERITY_META[sev].color }}
              />
              <span>{SEVERITY_META[sev].label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Interactive SVG Canvas */}
      <div className="relative aspect-[2/1] w-full">
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="h-full w-full select-none"
          role="img"
          aria-label="Regional site outage heatmap map"
        >
          <defs>
            <filter id="outage-heatmap-blur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
          </defs>

          {/* Subtle Coordinate Grid */}
          <g stroke="rgba(148, 163, 184, 0.1)" strokeWidth="1">
            {[100, 200, 300, 400].map((y) => (
              <line key={`h-${y}`} x1={0} y1={y} x2={VIEWBOX_WIDTH} y2={y} />
            ))}
            {[200, 400, 600, 800].map((x) => (
              <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={VIEWBOX_HEIGHT} />
            ))}
          </g>

          {/* Base Map Land/Region Shapes */}
          <g fill="rgba(30, 41, 59, 0.75)" stroke="rgba(71, 85, 105, 0.6)" strokeWidth="1">
            {mapPaths.map((d, idx) => (
              <path key={idx} d={d} />
            ))}
          </g>

          {/* Heatmap Cluster Glow Layer */}
          <g filter="url(#outage-heatmap-blur)">
            {projectedSites.map(({ site, x, y }) => {
              const meta = SEVERITY_META[site.severity];
              const radius =
                site.severity === "critical"
                  ? 44
                  : site.severity === "major"
                    ? 36
                    : site.severity === "minor"
                      ? 28
                      : 20;
              return (
                <circle
                  key={`heat-${site.id}`}
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={meta.haloColor}
                  pointerEvents="none"
                />
              );
            })}
          </g>

          {/* Outage Location Markers */}
          <g>
            {projectedSites.map(({ site, x, y }) => {
              const meta = SEVERITY_META[site.severity];
              const isHovered = hoveredSite?.id === site.id;

              return (
                <g
                  key={site.id}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${site.siteName} (${meta.label})`}
                  onMouseEnter={(e) => handleMarkerEnter(e, site)}
                  onMouseMove={(e) => handleMarkerMove(e, site)}
                  onMouseLeave={() => setHoveredSite(null)}
                  onFocus={() => {
                    setPointerPos({ x: (x / VIEWBOX_WIDTH) * 600, y: (y / VIEWBOX_HEIGHT) * 300 });
                    setHoveredSite(site);
                  }}
                  onBlur={() => setHoveredSite(null)}
                  onClick={() => onSelectSite?.(site)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectSite?.(site);
                    }
                  }}
                >
                  {/* Outer Pulse Ring */}
                  <circle
                    r={isHovered ? 14 : 10}
                    fill={meta.haloColor}
                  />
                  {/* Core Marker Dot */}
                  <circle
                    r={isHovered ? 7 : 5.5}
                    fill={meta.color}
                    stroke="#0f172a"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Hover Popover Card with Site Health Metrics */}
        {hoveredSite && (
          <div
            role="tooltip"
            className="pointer-events-none absolute z-20 w-64 rounded-lg border border-slate-700 bg-slate-900/95 p-3 text-xs text-slate-100 shadow-xl backdrop-blur-sm"
            style={{
              left: Math.min(Math.max(pointerPos.x + 14, 12), 360),
              top: Math.min(Math.max(pointerPos.y - 12, 12), 220),
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold text-slate-50">
                  {hoveredSite.siteName}
                </div>
                <div className="text-[11px] text-slate-400">
                  {hoveredSite.region}
                </div>
              </div>
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                  SEVERITY_META[hoveredSite.severity].badgeClasses
                }`}
              >
                {SEVERITY_META[hoveredSite.severity].label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-2">
              <div>
                <div className="text-[10px] text-slate-400">Uptime</div>
                <div className="font-mono font-medium text-slate-100">
                  {hoveredSite.uptimePct.toFixed(2)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Packet Loss</div>
                <div className="font-mono font-medium text-slate-100">
                  {hoveredSite.packetLossPct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Latency</div>
                <div className="font-mono font-medium text-slate-100">
                  {hoveredSite.latencyMs} ms
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">Incidents</div>
                <div className="font-mono font-medium text-slate-100">
                  {hoveredSite.activeIncidents}
                </div>
              </div>
            </div>

            <div className="mt-2 text-[10px] text-slate-500">
              Updated {hoveredSite.lastUpdated}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}