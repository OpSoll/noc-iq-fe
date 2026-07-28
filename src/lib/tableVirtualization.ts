// Closes #339: windowed row range calculation for large outage/payment tables
// Closes #340: WCAG 2.1 AA contrast ratio helper for audit/remediation

export interface VirtualRange {
  startIndex: number;
  endIndex: number;
  offsetTop: number;
}

export function getVirtualRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalRows: number,
  overscan = 5,
): VirtualRange {
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + overscan * 2;
  const end = Math.min(totalRows, start + visibleCount);
  return { startIndex: start, endIndex: end, offsetTop: start * rowHeight };
}

function channel(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// rgbA/rgbB as [r,g,b] 0-255 tuples. Returns the WCAG contrast ratio (1-21).
export function contrastRatio(rgbA: [number, number, number], rgbB: [number, number, number]): number {
  const l1 = relativeLuminance(rgbA);
  const l2 = relativeLuminance(rgbB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function passesAA(rgbA: [number, number, number], rgbB: [number, number, number], largeText = false): boolean {
  return contrastRatio(rgbA, rgbB) >= (largeText ? 3 : 4.5);
}
