/**
 * Main-thread client for the CSV parse Web Worker (#633).
 */

import type {
  CsvWorkerInMessage,
  CsvWorkerOutMessage,
} from './workers/csvParse.worker';

export interface CsvParseProgress {
  parsedRows: number;
  totalRowsEstimate?: number;
}

export interface CsvParseBatch {
  headers: string[];
  rows: string[][];
  batchIndex: number;
}

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export interface ParseCsvInWorkerOptions {
  batchSize?: number;
  onProgress?: (p: CsvParseProgress) => void;
  onBatch?: (b: CsvParseBatch) => void;
  /** Optional worker factory for tests (inject a mock Worker). */
  workerFactory?: () => Worker;
}

let seq = 0;

/**
 * Parse CSV text in a dedicated Web Worker, streaming batches back.
 * Rejects with the worker error message on failure.
 */
export function parseCsvInWorker(
  text: string,
  options: ParseCsvInWorkerOptions = {},
): { promise: Promise<CsvParseResult>; cancel: () => void } {
  const id = `csv-${++seq}`;
  const allRows: string[][] = [];
  let headers: string[] = [];

  let worker: Worker;
  try {
    worker =
      options.workerFactory?.() ??
      new Worker(new URL('./workers/csvParse.worker.ts', import.meta.url), {
        type: 'module',
      });
  } catch (err) {
    // Environments without Worker support — fall back to sync path via a microtask.
    return parseCsvSyncAsAsync(text, options);
  }

  const promise = new Promise<CsvParseResult>((resolve, reject) => {
    const onMessage = (event: MessageEvent<CsvWorkerOutMessage>) => {
      const msg = event.data;
      if (!msg || msg.id !== id) return;

      switch (msg.type) {
        case 'progress':
          options.onProgress?.({
            parsedRows: msg.parsedRows,
            totalRowsEstimate: msg.totalRowsEstimate,
          });
          break;
        case 'batch':
          headers = msg.headers;
          allRows.push(...msg.rows);
          options.onBatch?.({
            headers: msg.headers,
            rows: msg.rows,
            batchIndex: msg.batchIndex,
          });
          break;
        case 'done':
          cleanup();
          resolve({
            headers: msg.headers.length ? msg.headers : headers,
            rows: allRows,
            totalRows: msg.totalRows,
          });
          break;
        case 'error':
          cleanup();
          reject(new Error(msg.message));
          break;
      }
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || 'CSV worker failed'));
    };

    const cleanup = () => {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.terminate();
    };

    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);

    const payload: CsvWorkerInMessage = {
      type: 'parse',
      id,
      text,
      batchSize: options.batchSize ?? 500,
    };
    worker.postMessage(payload);
  });

  return {
    promise,
    cancel: () => {
      const payload: CsvWorkerInMessage = { type: 'cancel', id };
      try {
        worker.postMessage(payload);
        worker.terminate();
      } catch {
        /* already terminated */
      }
    },
  };
}

/** Test/helper sync parser matching worker batch semantics. */
export function parseCsvSync(text: string): CsvParseResult {
  const lines = text
    .replace(/^\uFEFF/, '')
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows, totalRows: rows.length };
}

function parseCsvSyncAsAsync(
  text: string,
  options: ParseCsvInWorkerOptions,
): { promise: Promise<CsvParseResult>; cancel: () => void } {
  let cancelled = false;
  const promise = Promise.resolve().then(() => {
    if (cancelled) throw new Error('cancelled');
    const result = parseCsvSync(text);
    const batchSize = options.batchSize ?? 500;
    for (let i = 0; i < result.rows.length; i += batchSize) {
      if (cancelled) throw new Error('cancelled');
      const batch = result.rows.slice(i, i + batchSize);
      options.onBatch?.({
        headers: result.headers,
        rows: batch,
        batchIndex: Math.floor(i / batchSize),
      });
      options.onProgress?.({
        parsedRows: Math.min(i + batchSize, result.rows.length),
        totalRowsEstimate: result.totalRows,
      });
    }
    return result;
  });
  return {
    promise,
    cancel: () => {
      cancelled = true;
    },
  };
}
