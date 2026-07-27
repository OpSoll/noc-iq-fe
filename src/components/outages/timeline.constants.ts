// src/components/outages/timeline.constants.ts

import type {
  OutageSeverity,
  TimelineZoomLevel,
} from './timeline.types';

export const TIMELINE_ZOOM_WINDOWS: Record<
  TimelineZoomLevel,
  number
> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export const SEVERITY_COLORS: Record<
  OutageSeverity,
  string
> = {
  low: 'var(--color-blue-500)',
  medium: 'var(--color-yellow-500)',
  high: 'var(--color-orange-500)',
  critical: 'var(--color-red-500)',
};

export const SEVERITY_LABELS: Record<
  OutageSeverity,
  string
> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const TIMELINE_ROW_HEIGHT = 48;
export const TIMELINE_BAR_HEIGHT = 28;
export const TIMELINE_LABEL_WIDTH = 180;
export const TIMELINE_MIN_BAR_WIDTH = 4;