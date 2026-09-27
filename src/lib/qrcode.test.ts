import { describe, it, expect } from 'vitest';

import {
  encodeQr,
  getByteCapacity,
  getQuietZoneModules,
  qrToPath,
  qrToSvg,
  QrCapacityError,
  type QrErrorCorrection,
} from '@/lib/qrcode';

const PUBLIC_KEY = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

describe('encodeQr', () => {
  it('picks the smallest version that fits the payload', () => {
    expect(encodeQr('a').version).toBe(1);
    expect(encodeQr('x'.repeat(14)).version).toBe(1);
    expect(encodeQr('x'.repeat(15)).version).toBe(2);
    expect(encodeQr(PUBLIC_KEY).version).toBe(4);
  });

  it('derives the matrix size from the version', () => {
    for (let version = 1; version <= 10; version++) {
      const qr = encodeQr('x'.repeat(getByteCapacity(version, 'M')), {
        errorCorrection: 'M',
        minVersion: version,
        maxVersion: version,
      });
      expect(qr.version).toBe(version);
      expect(qr.size).toBe(version * 4 + 17);
      expect(qr.modules).toHaveLength(qr.size);
      expect(qr.modules[0]).toHaveLength(qr.size);
    }
  });

  it('reports capacities matching the ISO/IEC 18004 byte-mode table', () => {
    const expected: Record<string, number[]> = {
      L: [17, 32, 53, 78, 106, 134, 154, 192, 230, 271],
      M: [14, 26, 42, 62, 84, 106, 122, 152, 180, 213],
      Q: [11, 20, 32, 46, 60, 74, 86, 108, 130, 151],
      H: [7, 14, 24, 34, 44, 58, 64, 84, 98, 119],
    };
    for (const level of Object.keys(expected) as QrErrorCorrection[]) {
      expected[level].forEach((capacity, index) => {
        expect(getByteCapacity(index + 1, level)).toBe(capacity);
      });
    }
  });

  it('defaults to error-correction level M', () => {
    expect(encodeQr('hello').errorCorrection).toBe('M');
  });

  it('draws all three finder patterns', () => {
    const qr = encodeQr(PUBLIC_KEY);
    const isDark = (x: number, y: number) => qr.modules[y][x];

    const finderAt = (ox: number, oy: number) => {
      for (let dy = 0; dy < 7; dy++) {
        for (let dx = 0; dx < 7; dx++) {
          const dist = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
          expect(isDark(ox + dx, oy + dy)).toBe(dist !== 2);
        }
      }
    };

    finderAt(0, 0);
    finderAt(qr.size - 7, 0);
    finderAt(0, qr.size - 7);
  });

  it('draws alternating timing patterns on row and column 6', () => {
    const qr = encodeQr(PUBLIC_KEY);
    for (let i = 8; i < qr.size - 8; i++) {
      expect(qr.modules[6][i]).toBe(i % 2 === 0);
      expect(qr.modules[i][6]).toBe(i % 2 === 0);
    }
  });

  it('keeps the dark module set at the bottom-left of the format area', () => {
    const qr = encodeQr(PUBLIC_KEY);
    expect(qr.modules[qr.size - 8][8]).toBe(true);
  });

  it('selects a mask between 0 and 7', () => {
    expect(encodeQr(PUBLIC_KEY).mask).toBeGreaterThanOrEqual(0);
    expect(encodeQr(PUBLIC_KEY).mask).toBeLessThanOrEqual(7);
  });

  it('keeps the dark-module ratio near 50%', () => {
    const qr = encodeQr(PUBLIC_KEY);
    const dark = qr.modules.flat().filter(Boolean).length;
    const ratio = dark / (qr.size * qr.size);
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it('reports the total codeword count including ECC', () => {
    // v1 has 26 total codewords: 16 data + 10 ECC at level M.
    expect(encodeQr('a').totalCodewords).toBe(26);
    // v4 has 100: 64 data + 2 blocks x 18 ECC.
    expect(encodeQr(PUBLIC_KEY).totalCodewords).toBe(100);
  });

  it('is deterministic for the same input', () => {
    expect(encodeQr(PUBLIC_KEY).modules).toEqual(encodeQr(PUBLIC_KEY).modules);
  });

  it('produces different output for different payloads', () => {
    expect(encodeQr('alpha').modules).not.toEqual(encodeQr('beta').modules);
  });

  it('throws a descriptive capacity error for an oversized payload', () => {
    expect(() => encodeQr('x'.repeat(500))).toThrow(QrCapacityError);
    expect(() => encodeQr('x'.repeat(500))).toThrow(/exceeds the QR capacity/);
  });

  it('honours an explicit maxVersion', () => {
    expect(() =>
      encodeQr('x'.repeat(100), { maxVersion: 1 })
    ).toThrow(QrCapacityError);
  });

  it('encodes multi-byte UTF-8 without loss', () => {
    const qr = encodeQr('aé漢🚀');
    expect(qr.version).toBeGreaterThanOrEqual(1);
    // 1 + 2 + 3 + 4 bytes plus header, so it cannot fit the 14-byte v1 payload.
    expect(qr.version).toBe(2);
  });
});

describe('qrToPath', () => {
  it('emits a path with a quiet-zone offset', () => {
    const qr = encodeQr(PUBLIC_KEY);
    const d = qrToPath(qr, { quietZone: 4 });
    expect(d).toMatch(/^M4,4/);
  });

  it('merges horizontally adjacent dark modules into single rectangles', () => {
    const qr = encodeQr(PUBLIC_KEY);
    // The top-left finder pattern's first row is 7 dark modules in a row, so
    // the leading run must be a single 7-wide rectangle.
    expect(qrToPath(qr, { quietZone: 0 })).toMatch(/^M0,0h7v1h-7z/);
  });
});

describe('qrToSvg', () => {
  it('renders a self-contained SVG document sized to the quiet zone', () => {
    const qr = encodeQr(PUBLIC_KEY);
    const quietZone = getQuietZoneModules();
    const dimension = (qr.size + quietZone * 2) * 4;
    const svg = qrToSvg(qr);

    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain(`width="${dimension}"`);
    expect(svg).toContain(`viewBox="0 0 ${dimension} ${dimension}"`);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).toContain('<rect');
    expect(svg).toContain('<path d="M');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('includes a title when one is supplied', () => {
    expect(qrToSvg(encodeQr('a'), { title: 'Public key' })).toContain(
      '<title>Public key</title>'
    );
  });
});
