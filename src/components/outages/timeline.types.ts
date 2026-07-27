// src/components/outages/timeline.types.ts

export type TimelineZoomLevel =
  | '1h'
  | '6h'
  | '24h'
  | '7d'
  | '30d';

export type OutageSeverity =
  | 'low'
  | 'medium'
  | 'high'
  | 'critical';

export type OutageStatus =
  | 'investigating'
  | 'identified'
  | 'monitoring'
  | 'resolved';

export interface OutageTimelineItem {
  id: string;
  service: string;
  severity: OutageSeverity;
  status: OutageStatus;
  startedAt: string | Date;
  resolvedAt?: string | Date | null;
}

export interface TimelineViewWindow {
  start: Date;
  end: Date;
}

export interface TimelineBar {
  outage: OutageTimelineItem;
  x: number;
  y: number;
  width: number;
  height: number;
  start: Date;
  end: Date;
  durationMs: number;
}