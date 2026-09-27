/**
 * CSV parsing Web Worker (#633).
 *
 * Runs PapaParse (or a minimal fallback) off the main thread and streams
 * row batches back so the UI can show progress without freezing.
 *
 * Protocol (main → worker):
 *   { type: 'parse', id: string, text: string, batchSize?: number }
 *   { type: 'cancel', id: string }
 *
 * Protocol (worker → main):
 *   { type: 'progress', id, parsedRows, totalRowsEstimate? }
 *   { type: 'batch', id, headers, rows, batchIndex }
 *   { type: 'done', id, headers, totalRows }
 *   { type: 'error', id, message }
 */

export type CsvWorkerInMessage =
  | { type: 'parse'; id: string; text: string; batchSize?: number }
  | { type: 'cancel'; id: string };

export type CsvWorkerOutMessage =
  | {
      type: 'progress';
      id: string;
      parsedRows: number;
      totalRowsEstimate?: number;
    }
  | {
      type: 'batch';
      id: string;
      headers: string[];
      rows: string[][];
      batchIndex: number;
    }
  | { type: 'done'; id: string; headers: string[]; totalRows: number }
  | { type: 'error'; id: string; message: string };

declare const self: DedicatedWorkerGlobalScope;

let cancelledIds = new Set<string>();

function parseLine(line: string): string[] {
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
}

/** Fallback parser used when PapaParse is unavailable in the worker bundle. */
function parseCsvFallback(
  text: string,
  batchSize: number,
  id: string,
  post: (msg: CsvWorkerOutMessage) => void,
): void {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    post({ type: 'done', id, headers: [], totalRows: 0 });
    return;
  }

  const headers = parseLine(lines[0]);
  let batch: string[][] = [];
  let batchIndex = 0;
  let parsedRows = 0;

  for (let i = 1; i < lines.length; i++) {
    if (cancelledIds.has(id)) return;
    batch.push(parseLine(lines[i]));
    parsedRows++;
    if (batch.length >= batchSize) {
      post({
        type: 'batch',
        id,
        headers,
        rows: batch,
        batchIndex,
      });
      post({ type: 'progress', id, parsedRows, totalRowsEstimate: lines.length - 1 });
      batch = [];
      batchIndex++;
    }
  }
  if (batch.length > 0) {
    post({ type: 'batch', id, headers, rows: batch, batchIndex });
  }
  post({ type: 'progress', id, parsedRows, totalRowsEstimate: parsedRows });
  post({ type: 'done', id, headers, totalRows: parsedRows });
}

async function parseWithPapa(
  text: string,
  batchSize: number,
  id: string,
  post: (msg: CsvWorkerOutMessage) => void,
): Promise<boolean> {
  try {
    // Dynamic import keeps the worker usable in tests without bundling Papa.
    const Papa = (await import('papaparse')).default;
    let headers: string[] = [];
    let batch: string[][] = [];
    let batchIndex = 0;
    let parsedRows = 0;
    let first = true;

    await new Promise<void>((resolve, reject) => {
      Papa.parse(text, {
        worker: false, // already inside a worker
        skipEmptyLines: true,
        step: (results: { data: string[]; errors: { message: string }[] }) => {
          if (cancelledIds.has(id)) {
            reject(new Error('cancelled'));
            return;
          }
          if (results.errors?.length) {
            // Continue; collect non-fatal row errors as empty cells
          }
          const row = (results.data ?? []).map((c) => String(c ?? '').trim());
          if (first) {
            headers = row;
            first = false;
            return;
          }
          batch.push(row);
          parsedRows++;
          if (batch.length >= batchSize) {
            post({ type: 'batch', id, headers, rows: batch, batchIndex });
            post({ type: 'progress', id, parsedRows });
            batch = [];
            batchIndex++;
          }
        },
        complete: () => {
          if (batch.length > 0) {
            post({ type: 'batch', id, headers, rows: batch, batchIndex });
          }
          post({ type: 'progress', id, parsedRows, totalRowsEstimate: parsedRows });
          post({ type: 'done', id, headers, totalRows: parsedRows });
          resolve();
        },
        error: (err: Error) => reject(err),
      });
    });
    return true;
  } catch {
    return false;
  }
}

self.onmessage = async (event: MessageEvent<CsvWorkerInMessage>) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'cancel') {
    cancelledIds.add(data.id);
    return;
  }

  if (data.type !== 'parse') return;
  const { id, text, batchSize = 500 } = data;
  cancelledIds.delete(id);

  const post = (msg: CsvWorkerOutMessage) => self.postMessage(msg);

  try {
    const usedPapa = await parseWithPapa(text, batchSize, id, post);
    if (!usedPapa && !cancelledIds.has(id)) {
      parseCsvFallback(text, batchSize, id, post);
    }
  } catch (err) {
    if ((err as Error).message === 'cancelled') return;
    post({
      type: 'error',
      id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};

export {};
