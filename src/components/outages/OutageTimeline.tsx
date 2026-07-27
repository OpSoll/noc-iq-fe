// src/components/outages/OutageTimeline.tsx

'use client';

import {
  useMemo,
  useState,
} from 'react';

import {
  SEVERITY_COLORS,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_ZOOM_WINDOWS,
} from './timeline.constants';

import {
  useTimelineLayout,
} from './useTimelineLayout';

import type {
  OutageSeverity,
  OutageTimelineItem,
  TimelineViewWindow,
  TimelineZoomLevel,
} from './timeline.types';

interface OutageTimelineProps {
  outages: OutageTimelineItem[];
  viewWindow: TimelineViewWindow;
  zoomLevel?: TimelineZoomLevel;
  onOutageClick?: (
    outage: OutageTimelineItem,
  ) => void;
}

const formatDuration = (
  durationMs: number,
): string => {
  const minutes = Math.floor(
    durationMs / (1000 * 60),
  );

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    return `${hours}h ${remainingMinutes}m`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ${hours % 24}h`;
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  ).format(date);
};

export function OutageTimeline({
  outages,
  viewWindow,
  zoomLevel = '24h',
  onOutageClick,
}: OutageTimelineProps) {
  const [hoveredOutage, setHoveredOutage] =
    useState<string | null>(null);

  const filteredOutages = useMemo(
    () => outages,
    [outages],
  );

  const {
    bars,
    contentWidth,
    contentHeight,
    getXPosition,
  } = useTimelineLayout(
    filteredOutages,
    viewWindow,
    {
      width: 1200,
    },
  );

  const timelineDuration =
    TIMELINE_ZOOM_WINDOWS[zoomLevel];

  const tickCount = 8;

  const ticks = Array.from(
    { length: tickCount + 1 },
    (_, index) => {
      const progress = index / tickCount;

      const timestamp =
        viewWindow.start.getTime() +
        progress * timelineDuration;

      return {
        x: getXPosition(
          new Date(timestamp),
        ),
        date: new Date(timestamp),
      };
    },
  );

  return (
    <div className="w-full overflow-hidden rounded-lg border border-border bg-background">
      <div className="overflow-x-auto overscroll-x-contain">
        <div
          className="min-w-[900px]"
          style={{
            width: contentWidth,
          }}
        >
          <div className="relative">
            {/* Timeline Header */}
            <div className="sticky top-0 z-10 flex h-12 border-b border-border bg-background">
              <div
                className="shrink-0 border-r border-border px-4 py-3 text-xs font-medium text-muted-foreground"
                style={{
                  width: TIMELINE_LABEL_WIDTH,
                }}
              >
                Service
              </div>

              <div className="relative flex-1">
                {ticks.map((tick) => (
                  <div
                    key={tick.date.toISOString()}
                    className="absolute top-0 h-full -translate-x-1/2"
                    style={{
                      left: tick.x,
                    }}
                  >
                    <div className="px-2 py-3 text-xs whitespace-nowrap text-muted-foreground">
                      {formatDate(tick.date)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Body */}
            <div
              className="relative"
              style={{
                height: contentHeight,
              }}
            >
              {/* Grid */}
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden="true"
              >
                {ticks.map((tick) => (
                  <line
                    key={tick.date.toISOString()}
                    x1={tick.x}
                    x2={tick.x}
                    y1={0}
                    y2={contentHeight}
                    className="stroke-border"
                    strokeDasharray="4 4"
                  />
                ))}
              </svg>

              {/* Outage Rows */}
              {bars.map((bar) => {
                const severity =
                  bar.outage.severity as OutageSeverity;

                const isHovered =
                  hoveredOutage ===
                  bar.outage.id;

                return (
                  <div
                    key={bar.outage.id}
                    className="absolute inset-x-0 border-b border-border/50"
                    style={{
                      top: bar.y - 10,
                      height: 48,
                    }}
                  >
                    <div
                      className="absolute left-0 flex h-full items-center border-r border-border bg-background px-4"
                      style={{
                        width: TIMELINE_LABEL_WIDTH,
                      }}
                    >
                      <span className="truncate text-sm font-medium">
                        {bar.outage.service}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="absolute rounded-md border border-white/10 shadow-sm transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{
                        left: bar.x,
                        top: 10,
                        width: bar.width,
                        height: bar.height,
                        backgroundColor:
                          SEVERITY_COLORS[
                            severity
                          ],
                        opacity: isHovered
                          ? 1
                          : 0.85,
                      }}
                      onMouseEnter={() =>
                        setHoveredOutage(
                          bar.outage.id,
                        )
                      }
                      onMouseLeave={() =>
                        setHoveredOutage(null)
                      }
                      onFocus={() =>
                        setHoveredOutage(
                          bar.outage.id,
                        )
                      }
                      onBlur={() =>
                        setHoveredOutage(null)
                      }
                      onClick={() =>
                        onOutageClick?.(
                          bar.outage,
                        )
                      }
                      aria-label={`${bar.outage.service} outage`}
                    >
                      <span className="sr-only">
                        {bar.outage.service} outage,
                        {bar.outage.severity},
                        {bar.outage.status}
                      </span>

                      {isHovered && (
                        <div className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-md border border-border bg-popover p-3 text-left text-popover-foreground shadow-lg">
                          <div className="mb-2 font-semibold">
                            {bar.outage.service}
                          </div>

                          <div className="space-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">
                                Outage ID:
                              </span>{' '}
                              {bar.outage.id}
                            </div>

                            <div>
                              <span className="text-muted-foreground">
                                Duration:
                              </span>{' '}
                              {formatDuration(
                                bar.durationMs,
                              )}
                            </div>

                            <div>
                              <span className="text-muted-foreground">
                                Status:
                              </span>{' '}
                              {bar.outage.status}
                            </div>

                            <div>
                              <span className="text-muted-foreground">
                                Started:
                              </span>{' '}
                              {formatDate(
                                bar.start,
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}