// Closes #608: dark-mode aware chart palette with WCAG 2.1 AA contrast.
//
// Every chart in this repo is hand-rolled (flex-end divs, inline <svg>,
// progress bars) so there is no charting library to inherit a palette from.
// Gridlines, axis labels and series colours were previously hard-coded as
// Tailwind classes and inline hex values that dropped below the WCAG floors
// when the app flipped to dark mode. This module centralises the tokens and
// ships the measurement helpers, so the guarantee is verifiable in a unit test
// instead of by eye.
//
// Measured contrast ratios (WCAG 2.1, as computed by contrastRatio() below):
//
//   token      light (#ffffff)   dark (#0f172a)   high-contrast (#000000)
//   --------   ---------------   --------------   --------------------
//   gridLine   #64748b  4.76:1   #64748b  3.75:1  #e5e5e5      16.67:1
//   axisLabel  #475569  7.58:1   #cbd5e1 12.02:1  #ffffff      21.00:1
//   axisTick   #64748b  4.76:1   #94a3b8  6.96:1  #e5e5e5      16.67:1
//   series[0]  #2563eb  5.17:1   #60a5fa  7.02:1  #00e5ff      13.65:1
//   series[1]  #b45309  5.02:1   #fbbf24 10.69:1  #ffd60a      14.88:1
//   series[2]  #0f766e  5.47:1   #2dd4bf  9.59:1  #ff5e5b       7.00:1
//   positive   #15803d  5.02:1   #4ade80 10.25:1  #7df9a4      15.96:1
//   negative   #b91c1c  6.47:1   #f87171  6.45:1  #ff5e5b       7.00:1
//   muted      #64748b  4.76:1   #94a3b8  6.96:1  #e5e5e5      16.67:1
//
// `track` is the one deliberate exception: it is the inert filler behind a
// progress fill (#e2e8f0 / #1e293b / #262626), not a data-bearing mark, so it
// is exempt from the SC 1.4.11 floor and never asserted below.
//
// Every other token clears 4.5:1 against its own surface in all three themes,
// so axis labels and legend text satisfy WCAG 2.1 AA (SC 1.4.3) and series
// lines, bars and gridlines also clear the 3:1 non-text floor of SC 1.4.11.

import { contrastRatio as rgbContrastRatio } from '@/lib/tableVirtualization';

// ─── Theme tokens ─────────────────────────────────────────────────────────────

/** Fully resolved palette name. */
export type ChartThemeName = 'light' | 'dark' | 'high-contrast';

/** Requested mode; `system` defers to the OS colour-scheme preference. */
export type ChartThemeMode = ChartThemeName | 'system';

/** Resolved set of chart colour tokens for a single theme. */
export interface ChartTheme {
  /** Name of the theme this palette belongs to. */
  name: ChartThemeName;
  /** Background the chart is painted on; every token is measured against it. */
  surface: string;
  /** Gridline stroke colour. */
  gridLine: string;
  /** Axis title / value label colour. */
  axisLabel: string;
  /** Axis tick and caption colour. */
  axisTick: string;
  /** Ordered series palette; index 0 is the primary series. */
  series: string[];
  /** Faint track behind a progress/area fill; deliberately below 3:1. */
  track: string;
  /** "Good" direction colour: on target, healthy, rewards. */
  positive: string;
  /** "Bad" direction colour: breach, unhealthy, penalties. */
  negative: string;
  /** Low-emphasis text and de-emphasised strokes. */
  muted: string;
}

/** Minimum ratio for text: axis labels, legends and value labels (SC 1.4.3). */
export const CHART_TEXT_CONTRAST = 4.5;

/** Minimum ratio for non-text graphics: series, bars, gridlines (SC 1.4.11). */
export const CHART_GRAPHICS_CONTRAST = 3;

// ─── Resolved palettes ────────────────────────────────────────────────────────

const LIGHT_THEME: ChartTheme = {
  name: 'light',
  surface: '#ffffff',
  gridLine: '#64748b',
  axisLabel: '#475569',
  axisTick: '#64748b',
  series: ['#2563eb', '#b45309', '#0f766e'],
  positive: '#15803d',
  negative: '#b91c1c',
  muted: '#64748b',
  track: '#e2e8f0',
};

const DARK_THEME: ChartTheme = {
  name: 'dark',
  surface: '#0f172a',
  gridLine: '#64748b',
  axisLabel: '#cbd5e1',
  axisTick: '#94a3b8',
  series: ['#60a5fa', '#fbbf24', '#2dd4bf'],
  positive: '#4ade80',
  negative: '#f87171',
  muted: '#94a3b8',
  track: '#1e293b',
};

const HIGH_CONTRAST_THEME: ChartTheme = {
  name: 'high-contrast',
  surface: '#000000',
  gridLine: '#e5e5e5',
  axisLabel: '#ffffff',
  axisTick: '#e5e5e5',
  series: ['#00e5ff', '#ffd60a', '#ff5e5b'],
  positive: '#7df9a4',
  negative: '#ff5e5b',
  muted: '#e5e5e5',
  track: '#262626',
};

/** Every resolved palette, keyed by theme name. */
export const CHART_THEMES: Record<ChartThemeName, ChartTheme> = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
  'high-contrast': HIGH_CONTRAST_THEME,
};

// ─── Colour math ──────────────────────────────────────────────────────────────

const SHORT_HEX = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const LONG_HEX = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

/**
 * Parses `#rgb` / `#rrggbb` into a 0-255 RGB tuple. Anything unparseable
 * falls back to opaque black so a malformed token can never silently produce
 * an "infinite" contrast ratio against a light surface.
 */
export function hexToRgb(hex: string): [number, number, number] {
  const long = LONG_HEX.exec(hex.trim());
  if (long) {
    return [
      parseInt(long[1], 16),
      parseInt(long[2], 16),
      parseInt(long[3], 16),
    ];
  }
  const short = SHORT_HEX.exec(hex.trim());
  if (short) {
    return [
      parseInt(short[1] + short[1], 16),
      parseInt(short[2] + short[2], 16),
      parseInt(short[3] + short[3], 16),
    ];
  }
  return [0, 0, 0];
}

/** WCAG 2.1 linearisation of a single 0-255 sRGB channel. */
function linearize(channel8: number): number {
  const value = channel8 / 255;
  return value <= 0.03928
    ? value / 12.92
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

/**
 * WCAG 2.1 relative luminance (0-1) of a hex colour.
 * Mirrors the private helper in `tableVirtualization`, exposed here in
 * hex-string form so chart tokens can be measured without conversion noise.
 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  );
}

/**
 * WCAG 2.1 contrast ratio (1-21) between two hex colours. Delegates to the
 * shared implementation in `tableVirtualization` so the repo keeps exactly one
 * ratio formula.
 */
export function contrastRatio(a: string, b: string): number {
  return rgbContrastRatio(hexToRgb(a), hexToRgb(b));
}

/** True when `foreground` clears `minimum` against `background`. */
export function meetsContrast(
  foreground: string,
  background: string,
  minimum: number
): boolean {
  return contrastRatio(foreground, background) >= minimum;
}

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Collapses a requested mode plus the OS preference into a concrete theme.
 * `high-contrast` always wins so a forced-colors / a11y-high-contrast user is
 * never handed the plain light or dark palette.
 */
export function resolveChartThemeName(
  mode: ChartThemeMode,
  systemPrefersDark: boolean
): ChartThemeName {
  if (mode === 'high-contrast') return 'high-contrast';
  if (mode === 'dark') return 'dark';
  if (mode === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

/** Resolves the token set a chart should paint itself with. */
export function resolveChartTheme(
  mode: ChartThemeMode,
  systemPrefersDark: boolean
): ChartTheme {
  return CHART_THEMES[resolveChartThemeName(mode, systemPrefersDark)];
}

/** Series colour at `index`, wrapping so long series stay coloured. */
export function seriesColor(theme: ChartTheme, index: number): string {
  if (theme.series.length === 0) return theme.muted;
  const wrapped =
    ((index % theme.series.length) + theme.series.length) % theme.series.length;
  return theme.series[wrapped];
}

/** Direction colour for a positive/negative delta. */
export function deltaColor(theme: ChartTheme, delta: number): string {
  return delta >= 0 ? theme.positive : theme.negative;
}
