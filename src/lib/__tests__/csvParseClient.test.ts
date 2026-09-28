import { describe, it, expect } from 'vitest';
import { parseCsvSync, parseCsvInWorker, type CsvParseResult } from '../csvParseClient';

describe('csvParseClient (#633)', () => {
  it('parseCsvSync parses headers and rows', () => {
    const csv = 'a,b\n1,2\n3,4\n';
    const result = parseCsvSync(csv);
    expect(result.headers).toEqual(['a', 'b']);
    expect(result.rows).toEqual([
      ['1', '2'],
      ['3', '4'],
    ]);
    expect(result.totalRows).toBe(2);
  });

  it('parseCsvSync handles quoted commas', () => {
    const csv = 'name,note\n"Acme, Inc",ok\n';
    const result = parseCsvSync(csv);
    expect(result.rows[0][0]).toBe('Acme, Inc');
  });

  it('parseCsvInWorker streams batches via injected mock worker', async () => {
    const batches: number[] = [];
    const progress: number[] = [];

    class MockWorker {
      listeners = new Map<string, Set<(e: MessageEvent) => void>>();
      addEventListener(type: string, fn: (e: MessageEvent) => void) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type)!.add(fn);
      }
      removeEventListener(type: string, fn: (e: MessageEvent) => void) {
        this.listeners.get(type)?.delete(fn);
      }
      postMessage(data: { type: string; id: string }) {
        if (data.type !== 'parse') return;
        const id = data.id;
        const emit = (msg: unknown) => {
          this.listeners.get('message')?.forEach((fn) =>
            fn({ data: msg } as MessageEvent),
          );
        };
        emit({
          type: 'batch',
          id,
          headers: ['x'],
          rows: [['1'], ['2']],
          batchIndex: 0,
        });
        emit({ type: 'progress', id, parsedRows: 2, totalRowsEstimate: 2 });
        emit({ type: 'done', id, headers: ['x'], totalRows: 2 });
      }
      terminate() {}
    }

    const { promise } = parseCsvInWorker('x\n1\n2\n', {
      workerFactory: () => new MockWorker() as unknown as Worker,
      onBatch: (b) => batches.push(b.rows.length),
      onProgress: (p) => progress.push(p.parsedRows),
    });

    const result: CsvParseResult = await promise;
    expect(result.totalRows).toBe(2);
    expect(result.headers).toEqual(['x']);
    expect(batches[0]).toBe(2);
    expect(progress[0]).toBe(2);
  });

  it('parseCsvInWorker rejects on worker error message', async () => {
    class ErrorWorker {
      listeners = new Map<string, Set<(e: MessageEvent) => void>>();
      addEventListener(type: string, fn: (e: MessageEvent) => void) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type)!.add(fn);
      }
      removeEventListener() {}
      postMessage(data: { type: string; id: string }) {
        if (data.type !== 'parse') return;
        this.listeners.get('message')?.forEach((fn) =>
          fn({
            data: { type: 'error', id: data.id, message: 'boom' },
          } as MessageEvent),
        );
      }
      terminate() {}
    }

    const { promise } = parseCsvInWorker('a\n1', {
      workerFactory: () => new ErrorWorker() as unknown as Worker,
    });
    await expect(promise).rejects.toThrow('boom');
  });
});
