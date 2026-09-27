/**
 * Dependency-free QR Code encoder (ISO/IEC 18004).
 *
 * Scope is deliberately narrow: byte mode and versions 1-10, across all four
 * error-correction levels. That covers every payload this app renders through
 * a QR code (Stellar public keys, `stellar:<key>` URIs, webhook URLs) without
 * pulling a third-party encoder into the bundle.
 *
 * Public entry points:
 * • `encodeQr(text)` → module matrix + geometry
 * • `qrToSvg(qr)`   → standalone SVG markup string
 * • `qrToPath(qr)`  → single `<path>` `d` string, for inline React usage
 *
 * Closes #658 — QR code modal for public key sharing.
 */

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

export interface QrCode {
  /** Matrix edge length in modules (includes no quiet zone). */
  size: number;
  /** `modules[y][x]` is `true` when the module is dark. */
  modules: boolean[][];
  version: number;
  errorCorrection: QrErrorCorrection;
  mask: number;
  /** Total codewords (data + ECC) placed in the symbol. */
  totalCodewords: number;
}

const MAX_VERSION = 10;
const MIN_VERSION = 1;
const DEFAULT_ERROR_CORRECTION: QrErrorCorrection = 'M';

/** ECC codewords per block, indexed `[errorCorrection][version]`. */
const ECC_CODEWORDS_PER_BLOCK: Record<QrErrorCorrection, number[]> = {
  L: [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18],
  M: [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
  H: [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28],
};

/** Number of ECC blocks, indexed `[errorCorrection][version]`. */
const NUM_ERROR_CORRECTION_BLOCKS: Record<QrErrorCorrection, number[]> = {
  L: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4],
  M: [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
  H: [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8],
};

/** Alignment pattern row/column centre coordinates, versions 1-10. */
const ALIGNMENT_PATTERN_POSITIONS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

/** 2-bit format-info encoding of each error-correction level. */
const ECC_FORMAT_BITS: Record<QrErrorCorrection, number> = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
};

class QrCapacityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QrCapacityError';
  }
}

export { QrCapacityError };

// ---------------------------------------------------------------------------
// Bit / byte helpers
// ---------------------------------------------------------------------------

function getBit(value: number, index: number): boolean {
  return ((value >>> index) & 1) !== 0;
}

/** UTF-8 encodes a string to bytes without relying on `TextEncoder` (jsdom safe). */
function utf8Bytes(text: string): number[] {
  if (typeof TextEncoder !== 'undefined') {
    return Array.from(new TextEncoder().encode(text));
  }
  const bytes: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return bytes;
}

/** Total data codewords (payload + pad, before ECC) for a version/level. */
function getNumDataCodewords(version: number, errorCorrection: QrErrorCorrection) {
  return (
    Math.floor(getNumRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[errorCorrection][version] *
      NUM_ERROR_CORRECTION_BLOCKS[errorCorrection][version]
  );
}

/** Number of data modules available on a version, before ECC. */
function getNumRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

/** Byte-mode character-count field width for a version. */
function getCharCountBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

/** Maximum number of payload bytes a version can carry in byte mode. */
export function getByteCapacity(
  version: number,
  errorCorrection: QrErrorCorrection = DEFAULT_ERROR_CORRECTION
): number {
  const bits = getNumDataCodewords(version, errorCorrection) * 8;
  return Math.floor((bits - 4 - getCharCountBits(version)) / 8);
}

// ---------------------------------------------------------------------------
// Reed-Solomon
// ---------------------------------------------------------------------------

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsComputeDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;

  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsComputeRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result[0];
    result.shift();
    result.push(0);
    for (let i = 0; i < result.length; i++) {
      result[i] ^= gfMultiply(divisor[i], factor);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Segment construction
// ---------------------------------------------------------------------------

function buildDataCodewords(
  bytes: number[],
  version: number,
  errorCorrection: QrErrorCorrection
): number[] {
  const capacityBits = getNumDataCodewords(version, errorCorrection) * 8;

  const bits: boolean[] = [];
  const pushBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push(getBit(value, i));
  };

  // Byte mode indicator (0100) then the character count.
  pushBits(0b0100, 4);
  pushBits(bytes.length, getCharCountBits(version));
  for (const byte of bytes) pushBits(byte, 8);

  if (bits.length > capacityBits) {
    throw new QrCapacityError(
      `Payload of ${bytes.length} bytes does not fit version ${version} at error-correction level ${errorCorrection}`
    );
  }

  // Terminator: up to four zero bits, truncated to the symbol capacity.
  pushBits(0, Math.max(0, Math.min(4, capacityBits - bits.length)));
  // Pad to a whole codeword.
  while (bits.length % 8 !== 0) bits.push(false);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] ? 1 : 0);
    codewords.push(byte);
  }
  // Alternating pad codewords until the data capacity is filled exactly.
  for (let pad = 0xec; codewords.length * 8 + 8 <= capacityBits; pad ^= 0xec ^ 0x11) {
    codewords.push(pad);
  }
  return codewords;
}

function interleaveWithEcc(
  data: number[],
  version: number,
  errorCorrection: QrErrorCorrection
): number[] {
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[errorCorrection][version];
  const eccLen = ECC_CODEWORDS_PER_BLOCK[errorCorrection][version];
  const rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const divisor = rsComputeDivisor(eccLen);
  const blocks: { data: number[]; ecc: number[]; buffer: number[] }[] = [];

  for (let i = 0, k = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - eccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const ecc = rsComputeRemainder(dat, divisor);
    // Short blocks get a padding placeholder so columns line up.
    const buffer = i < numShortBlocks ? [...dat, 0, ...ecc] : [...dat, ...ecc];
    blocks.push({ data: dat, ecc, buffer });
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].buffer.length; i++) {
    for (let j = 0; j < blocks.length; j++) {
      // Skip the placeholder column of short blocks.
      if (i === blocks[j].data.length && j < numShortBlocks) continue;
      result.push(blocks[j].buffer[i]);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Matrix construction
// ---------------------------------------------------------------------------

type Grid = {
  modules: boolean[][];
  isFunction: boolean[][];
  size: number;
};

function createGrid(size: number): Grid {
  return {
    modules: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    isFunction: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    size,
  };
}

function setFunctionModule(grid: Grid, x: number, y: number, dark: boolean) {
  grid.modules[y][x] = dark;
  grid.isFunction[y][x] = true;
}

function drawFunctionPatterns(
  grid: Grid,
  version: number,
  errorCorrection: QrErrorCorrection
) {
  const { size } = grid;

  // Timing patterns first; finder and alignment patterns overwrite the ends.
  for (let i = 0; i < size; i++) {
    setFunctionModule(grid, 6, i, i % 2 === 0);
    setFunctionModule(grid, i, 6, i % 2 === 0);
  }

  drawFinderPattern(grid, 3, 3);
  drawFinderPattern(grid, size - 4, 3);
  drawFinderPattern(grid, 3, size - 4);

  const alignPositions = ALIGNMENT_PATTERN_POSITIONS[version];
  const numAlign = alignPositions.length;
  for (let i = 0; i < numAlign; i++) {
    for (let j = 0; j < numAlign; j++) {
      const isCorner =
        (i === 0 && j === 0) ||
        (i === 0 && j === numAlign - 1) ||
        (i === numAlign - 1 && j === 0);
      if (!isCorner) {
        drawAlignmentPattern(grid, alignPositions[j], alignPositions[i]);
      }
    }
  }

  // Reserve the format-information areas; real bits are written after masking.
  drawFormatBits(grid, 0, errorCorrection);
  drawVersionBits(grid, version);
}

function drawFinderPattern(grid: Grid, cx: number, cy: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || x >= grid.size || y < 0 || y >= grid.size) continue;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      setFunctionModule(grid, x, y, dist !== 2 && dist !== 4);
    }
  }
}

function drawAlignmentPattern(grid: Grid, cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunctionModule(grid, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
}

function drawFormatBits(grid: Grid, mask: number, errorCorrection: QrErrorCorrection) {
  const data = (ECC_FORMAT_BITS[errorCorrection] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;

  // Copy 1 — around the top-left finder pattern.
  for (let i = 0; i <= 5; i++) setFunctionModule(grid, 8, i, getBit(bits, i));
  setFunctionModule(grid, 8, 7, getBit(bits, 6));
  setFunctionModule(grid, 8, 8, getBit(bits, 7));
  setFunctionModule(grid, 7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i++) setFunctionModule(grid, 14 - i, 8, getBit(bits, i));

  // Copy 2 — split between the other two finder patterns.
  for (let i = 0; i < 8; i++) setFunctionModule(grid, grid.size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i++) setFunctionModule(grid, 8, grid.size - 15 + i, getBit(bits, i));
  setFunctionModule(grid, 8, grid.size - 8, true);
}

function drawVersionBits(grid: Grid, version: number) {
  if (version < 7) return;

  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (version << 12) | rem;

  for (let i = 0; i < 18; i++) {
    const bit = getBit(bits, i);
    const a = grid.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    setFunctionModule(grid, a, b, bit);
    setFunctionModule(grid, b, a, bit);
  }
}

function drawCodewords(grid: Grid, data: number[]) {
  let i = 0;
  for (let right = grid.size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < grid.size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? grid.size - 1 - vert : vert;
        if (!grid.isFunction[y][x] && i < data.length * 8) {
          grid.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Masking
// ---------------------------------------------------------------------------

const MASK_FUNCTIONS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(grid: Grid, mask: number) {
  for (let y = 0; y < grid.size; y++) {
    for (let x = 0; x < grid.size; x++) {
      if (!grid.isFunction[y][x] && MASK_FUNCTIONS[mask](x, y)) {
        grid.modules[y][x] = !grid.modules[y][x];
      }
    }
  }
}

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

/**
 * ISO/IEC 18004 penalty score. Lower is better; the encoder picks the mask
 * that minimises it because a low score is what real scanners optimise for.
 *
 * Rules 1 and 3 are evaluated together per line, tracking a 7-deep history of
 * run lengths so finder-like sequences can be detected in one pass.
 */
function computePenalty(grid: Grid): number {
  const { size, modules } = grid;
  let penalty = 0;

  for (let y = 0; y < size; y++) {
    let runColor = modules[y][0];
    let runLength = 1;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let x = 1; x < size; x++) {
      if (modules[y][x] === runColor) {
        runLength++;
        if (runLength === 5) penalty += PENALTY_N1;
        else if (runLength > 5) penalty += 1;
      } else {
        addRunToHistory(runLength, history, size);
        if (!runColor) penalty += countFinderPatterns(history) * PENALTY_N3;
        runColor = modules[y][x];
        runLength = 1;
      }
    }
    penalty += terminateRun(runColor, runLength, history, size) * PENALTY_N3;
  }

  for (let x = 0; x < size; x++) {
    let runColor = modules[0][x];
    let runLength = 1;
    const history = [0, 0, 0, 0, 0, 0, 0];
    for (let y = 1; y < size; y++) {
      if (modules[y][x] === runColor) {
        runLength++;
        if (runLength === 5) penalty += PENALTY_N1;
        else if (runLength > 5) penalty += 1;
      } else {
        addRunToHistory(runLength, history, size);
        if (!runColor) penalty += countFinderPatterns(history) * PENALTY_N3;
        runColor = modules[y][x];
        runLength = 1;
      }
    }
    penalty += terminateRun(runColor, runLength, history, size) * PENALTY_N3;
  }

  // Rule 2: 2x2 blocks of identical colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const color = modules[y][x];
      if (
        color === modules[y][x + 1] &&
        color === modules[y + 1][x] &&
        color === modules[y + 1][x + 1]
      ) {
        penalty += PENALTY_N2;
      }
    }
  }

  // Rule 4: deviation of the dark-module ratio from 50%, in 5% steps.
  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) if (modules[y][x]) dark++;
  }
  const total = size * size;
  const k = (Math.abs(dark * 20 - total * 10) + total - 1) / total - 1;
  penalty += k * PENALTY_N4;

  return penalty;
}

function addRunToHistory(runLength: number, history: number[], size: number) {
  // A leading run of the border colour is extended by the implied quiet zone.
  if (history[0] === 0) runLength += size;
  history.pop();
  history.unshift(runLength);
}

function countFinderPatterns(history: number[]): number {
  const n = history[1];
  const isCore =
    n > 0 &&
    history[2] === n &&
    history[3] === n * 3 &&
    history[4] === n &&
    history[5] === n;
  return (
    (isCore && history[0] >= n * 4 && history[6] >= n ? 1 : 0) +
    (isCore && history[6] >= n * 4 && history[0] >= n ? 1 : 0)
  );
}

function terminateRun(
  runColor: boolean,
  runLength: number,
  history: number[],
  size: number
): number {
  if (runColor) {
    addRunToHistory(runLength, history, size);
    runLength = 0;
  }
  // The trailing quiet zone is always light.
  runLength += size;
  addRunToHistory(runLength, history, size);
  return countFinderPatterns(history);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface EncodeQrOptions {
  errorCorrection?: QrErrorCorrection;
  minVersion?: number;
  maxVersion?: number;
}

/** Encodes `text` as a QR code matrix. */
export function encodeQr(text: string, options: EncodeQrOptions = {}): QrCode {
  const errorCorrection = options.errorCorrection ?? DEFAULT_ERROR_CORRECTION;
  const minVersion = options.minVersion ?? MIN_VERSION;
  const maxVersion = Math.min(options.maxVersion ?? MAX_VERSION, MAX_VERSION);

  const bytes = utf8Bytes(text);
  let version = 0;
  for (let v = Math.max(MIN_VERSION, minVersion); v <= maxVersion; v++) {
    if (bytes.length <= getByteCapacity(v, errorCorrection)) {
      version = v;
      break;
    }
  }
  if (version === 0) {
    throw new QrCapacityError(
      `Payload of ${bytes.length} bytes exceeds the QR capacity of version ${maxVersion} at error-correction level ${errorCorrection}`
    );
  }

  const dataCodewords = buildDataCodewords(bytes, version, errorCorrection);
  const allCodewords = interleaveWithEcc(dataCodewords, version, errorCorrection);
  const size = version * 4 + 17;
  const grid = createGrid(size);

  drawFunctionPatterns(grid, version, errorCorrection);
  drawCodewords(grid, allCodewords);

  // Choose the mask with the lowest penalty score.
  let bestMask = 0;
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let mask = 0; mask < 8; mask++) {
    applyMask(grid, mask);
    drawFormatBits(grid, mask, errorCorrection);
    const penalty = computePenalty(grid);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = mask;
    }
    applyMask(grid, mask); // XOR is its own inverse — undo before retrying.
  }
  applyMask(grid, bestMask);
  drawFormatBits(grid, bestMask, errorCorrection);

  return {
    size,
    modules: grid.modules,
    version,
    errorCorrection,
    mask: bestMask,
    totalCodewords: allCodewords.length,
  };
}

/** Number of modules in a row, useful for sizing the rendered SVG. */
export function getQuietZoneModules() {
  return 4;
}

export interface QrSvgOptions {
  /** Quiet zone width in modules. The spec requires at least 4. */
  quietZone?: number;
  /** Module size in SVG user units. */
  moduleSize?: number;
  darkColor?: string;
  lightColor?: string;
  /** Optional accessible label rendered as the SVG `<title>`. */
  title?: string;
}

/**
 * Renders a QR code as a single `<path>` `d` string in a viewBox that already
 * accounts for the quiet zone. One path keeps the DOM small — a v5 code is
 * ~1,000 modules and rect-per-module is measurably slower to paint.
 */
export function qrToPath(qr: QrCode, options: QrSvgOptions = {}): string {
  const quietZone = options.quietZone ?? getQuietZoneModules();
  const parts: string[] = [];

  // Merge horizontally adjacent dark modules into single rectangles.
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (!qr.modules[y][x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < qr.size && qr.modules[y][x + run]) run++;
      parts.push(
        `M${x + quietZone},${y + quietZone}h${run}v1h-${run}z`
      );
      x += run;
    }
  }
  return parts.join('');
}

/** Renders a standalone, self-contained SVG document string. */
export function qrToSvg(qr: QrCode, options: QrSvgOptions = {}): string {
  const quietZone = options.quietZone ?? getQuietZoneModules();
  const moduleSize = options.moduleSize ?? 4;
  const darkColor = options.darkColor ?? '#0f172a';
  const lightColor = options.lightColor ?? '#ffffff';
  const dimension = (qr.size + quietZone * 2) * moduleSize;
  const title = options.title
    ? `<title>${options.title}</title>`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}"`,
    ` viewBox="0 0 ${dimension} ${dimension}" shape-rendering="crispEdges" role="img">`,
    title,
    `<rect width="${dimension}" height="${dimension}" fill="${lightColor}"/>`,
    `<path d="${qrToPath(qr, { quietZone })}" fill="${darkColor}"/>`,
    '</svg>',
  ].join('');
}
