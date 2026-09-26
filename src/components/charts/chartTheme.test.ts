import { describe, it, expect } from 'vitest';

import {
  CHART_GRAPHICS_CONTRAST,
  CHART_TEXT_CONTRAST,
  CHART_THEMES,
  contrastRatio,
  deltaColor,
  hexToRgb,
  meetsContrast,
  relativeLuminance,
  resolveChartTheme,
  resolveChartThemeName,
  seriesColor,
  type ChartThemeName,
} from './chartTheme';

const THEME_NAMES: ChartThemeName[] = ['light', 'dark', 'high-contrast'];

// ─── Colour math ──────────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('parses six-digit hex', () => {
    expect(hexToRgb('#2563eb')).toEqual([37, 99, 235]);
  });

  it('accepts hex without the leading hash', () => {
    expect(hexToRgb('2563eb')).toEqual([37, 99, 235]);
  });

  it('expands three-digit shorthand', () => {
    expect(hexToRgb('#f00')).toEqual([255, 0, 0]);
  });

  it('falls back to black for unparseable input', () => {
    expect(hexToRgb('not-a-colour')).toEqual([0, 0, 0]);
  });
});

describe('relativeLuminance', () => {
  it('returns 1 for white and 0 for black', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('is monotonic — a darker colour never scores higher', () => {
    const light = relativeLuminance('#94a3b8');
    const dark = relativeLuminance('#475569');
    expect(light).toBeGreaterThan(dark);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white and 1:1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#2563eb', '#2563eb')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#475569', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#475569'),
      6
    );
  });
});

describe('meetsContrast', () => {
  it('enforces the supplied minimum', () => {
    expect(meetsContrast('#475569', '#ffffff', CHART_TEXT_CONTRAST)).toBe(
      true
    );
    expect(meetsContrast('#cbd5e1', '#ffffff', CHART_TEXT_CONTRAST)).toBe(
      false
    );
  });
});

// ─── Palette resolution ───────────────────────────────────────────────────────

describe('resolveChartThemeName', () => {
  it('honours an explicit light selection', () => {
    expect(resolveChartThemeName('light', true)).toBe('light');
  });

  it('honours an explicit dark selection', () => {
    expect(resolveChartThemeName('dark', false)).toBe('dark');
  });

  it('follows the OS preference in system mode', () => {
    expect(resolveChartThemeName('system', true)).toBe('dark');
    expect(resolveChartThemeName('system', false)).toBe('light');
  });

  it('lets high-contrast win over every other mode', () => {
    expect(resolveChartThemeName('high-contrast', false)).toBe(
      'high-contrast'
    );
    expect(resolveChartThemeName('high-contrast', true)).toBe(
      'high-contrast'
    );
  });
});

describe('resolveChartTheme', () => {
  it('returns the matching palette object', () => {
    expect(resolveChartTheme('dark', false)).toBe(CHART_THEMES.dark);
    expect(resolveChartTheme('light', true)).toBe(CHART_THEMES.light);
    expect(resolveChartTheme('system', true)).toBe(CHART_THEMES.dark);
    expect(resolveChartTheme('high-contrast', false)).toBe(
      CHART_THEMES['high-contrast']
    );
  });

  it('tags each palette with its own name', () => {
    for (const name of THEME_NAMES) {
      expect(resolveChartTheme(name, false).name).toBe(name);
    }
  });
});

// ─── Contrast guarantees ──────────────────────────────────────────────────────

describe.each(THEME_NAMES)('%s palette contrast', (name) => {
  const theme = CHART_THEMES[name];

  it('meets AA for axis and value text against its own surface', () => {
    for (const token of [theme.axisLabel, theme.axisTick, theme.muted]) {
      expect(
        meetsContrast(token, theme.surface, CHART_TEXT_CONTRAST),
        `${token} on ${theme.surface}`
      ).toBe(true);
    }
  });

  it('meets the non-text floor for gridlines and series lines', () => {
    expect(
      meetsContrast(theme.gridLine, theme.surface, CHART_GRAPHICS_CONTRAST)
    ).toBe(true);
    for (const color of theme.series) {
      expect(
        meetsContrast(color, theme.surface, CHART_GRAPHICS_CONTRAST),
        color
      ).toBe(true);
    }
  });

  it('meets AA for positive and negative direction colours', () => {
    expect(
      meetsContrast(theme.positive, theme.surface, CHART_TEXT_CONTRAST)
    ).toBe(true);
    expect(
      meetsContrast(theme.negative, theme.surface, CHART_TEXT_CONTRAST)
    ).toBe(true);
  });

  it('exposes at least three distinct series colours', () => {
    expect(theme.series.length).toBeGreaterThanOrEqual(3);
    expect(new Set(theme.series).size).toBe(theme.series.length);
  });
});

describe('theme separation', () => {
  it('uses a different series palette per theme', () => {
    const palettes = THEME_NAMES.map((n) => CHART_THEMES[n].series.join(','));
    expect(new Set(palettes).size).toBe(THEME_NAMES.length);
  });

  it('uses a different surface per theme', () => {
    const surfaces = THEME_NAMES.map((n) => CHART_THEMES[n].surface);
    expect(new Set(surfaces).size).toBe(THEME_NAMES.length);
  });
});

// ─── Token helpers ────────────────────────────────────────────────────────────

describe('seriesColor', () => {
  it('returns palette entries in order', () => {
    const theme = CHART_THEMES.light;
    expect(seriesColor(theme, 0)).toBe(theme.series[0]);
    expect(seriesColor(theme, 1)).toBe(theme.series[1]);
  });

  it('wraps out-of-range indexes instead of returning undefined', () => {
    const theme = CHART_THEMES.dark;
    expect(seriesColor(theme, 3)).toBe(theme.series[0]);
    expect(seriesColor(theme, 7)).toBe(theme.series[1]);
  });

  it('handles negative indexes', () => {
    const theme = CHART_THEMES.light;
    expect(seriesColor(theme, -1)).toBe(theme.series[2]);
  });
});

describe('deltaColor', () => {
  it('uses the positive token for zero and gains', () => {
    expect(deltaColor(CHART_THEMES.light, 0)).toBe(
      CHART_THEMES.light.positive
    );
    expect(deltaColor(CHART_THEMES.light, 4.2)).toBe(
      CHART_THEMES.light.positive
    );
  });

  it('uses the negative token for losses', () => {
    expect(deltaColor(CHART_THEMES.dark, -0.1)).toBe(
      CHART_THEMES.dark.negative
    );
  });
});
