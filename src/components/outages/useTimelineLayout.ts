// src/components/outages/useTimelineLayout.ts

import {
  TIMELINE_BAR_HEIGHT,
  TIMELINE_LABEL_WIDTH,
  TIMELINE_MIN_BAR_WIDTH,
  TIMELINE_ROW_HEIGHT,
} from './timeline.constants';

import type {
  OutageTimelineItem,
  TimelineBar,
  TimelineViewWindow,
} from './timeline.types';

interface UseTimelineLayoutOptions {
  width: number;
  rowHeight?: number;
  barHeight?: number;
}

interface TimelineLayoutResult {
  bars: TimelineBar[];
  contentWidth: number;
  contentHeight: number;
  getXPosition: (date: Date) => number;
}

const toDate = (value: string | Date): Date => {
  return value instanceof Date ? value : new Date(value);
};

export function useTimelineLayout(
  outages: OutageTimelineItem[],
  viewWindow: TimelineViewWindow,
  options: UseTimelineLayoutOptions,
): TimelineLayoutResult {
  const {
    width,
    rowHeight = TIMELINE_ROW_HEIGHT,
    barHeight = TIMELINE_BAR_HEIGHT,
  } = options;

  const windowStart = viewWindow.start.getTime();
  const windowEnd = viewWindow.end.getTime();

  const windowDuration = Math.max(
    windowEnd - windowStart,
    1,
  );

  const timelineWidth = Math.max(
    width - TIMELINE_LABEL_WIDTH,
    1,
  );

  const getXPosition = (date: Date): number => {
    const timestamp = date.getTime();

    const progress =
      (timestamp - windowStart) / windowDuration;

    return TIMELINE_LABEL_WIDTH + progress * timelineWidth;
  };

  const bars: TimelineBar[] = outages
    .map((outage, index) => {
      const start = toDate(outage.startedAt);

      const end = outage.resolvedAt
        ? toDate(outage.resolvedAt)
        : new Date();

      const visibleStart = new Date(
        Math.max(start.getTime(), windowStart),
      );

      const visibleEnd = new Date(
        Math.min(end.getTime(), windowEnd),
      );

      if (
        visibleEnd.getTime() <=
        visibleStart.getTime()
      ) {
        return null;
      }

      const x = getXPosition(visibleStart);

      const endX = getXPosition(visibleEnd);

      const width = Math.max(
        endX - x,
        TIMELINE_MIN_BAR_WIDTH,
      );

      return {
        outage,
        x,
        y: index * rowHeight + (rowHeight - barHeight) / 2,
        width,
        height: barHeight,
        start: visibleStart,
        end: visibleEnd,
        durationMs:
          end.getTime() - start.getTime(),
      };
    })
    .filter(
      (bar): bar is TimelineBar => bar !== null,
    );

  return {
    bars,
    contentWidth: width,
    contentHeight: outages.length * rowHeight,
    getXPosition,
  };
}