/**
 * Issue #631 – Client-side duplicate row detection for bulk import.
 *
 * Flags rows that share the same site_id/service_id + start_time combination
 * and supports an "Exclude Duplicates" mode that marks later occurrences
 * as excluded from the import batch.
 */

'use client';

import { useMemo } from 'react';

/** Preferred identity columns (issue says site_id; codebase uses service_id). */
export const DUPLICATE_ID_FIELDS = ['site_id', 'service_id'] as const;
export const DUPLICATE_TIME_FIELD = 'start_time';

export interface DuplicateHit {
  /** 0-based index into the data rows array */
  rowIndex: number;
  /** Spreadsheet row number (header is row 1) */
  sheetRow: number;
  /** Key used for grouping: `${id}|${start_time}` */
  key: string;
  /** Index of the first occurrence of this key (kept when excluding) */
  firstOccurrenceIndex: number;
}

export interface DuplicateDetectionResult {
  hits: DuplicateHit[];
  /** Count of rows that are duplicates of an earlier row */
  duplicateCount: number;
  /** Map of rowIndex -> true for rows that should be excluded when option is on */
  excludedRowIndexes: Set<number>;
  /** Unique keys that had more than one row */
  duplicateKeys: string[];
}

/**
 * Detect duplicate rows by (site_id|service_id) + start_time.
 * The first occurrence of each key is retained; subsequent ones are flagged.
 */
export function detectDuplicateRows(
  headers: string[],
  rows: string[][]
): DuplicateDetectionResult {
  const idField =
    DUPLICATE_ID_FIELDS.find((f) => headers.includes(f)) ?? null;
  const timeIdx = headers.indexOf(DUPLICATE_TIME_FIELD);
  const idIdx = idField ? headers.indexOf(idField) : -1;

  if (idIdx < 0 || timeIdx < 0) {
    return {
      hits: [],
      duplicateCount: 0,
      excludedRowIndexes: new Set(),
      duplicateKeys: [],
    };
  }

  const firstSeen = new Map<string, number>();
  const hits: DuplicateHit[] = [];
  const excludedRowIndexes = new Set<number>();
  const multiKeys = new Set<string>();

  rows.forEach((row, rowIndex) => {
    const idVal = (row[idIdx] ?? '').trim();
    const timeVal = (row[timeIdx] ?? '').trim();
    if (!idVal || !timeVal) return;

    const key = `${idVal}|${timeVal}`;
    if (firstSeen.has(key)) {
      const first = firstSeen.get(key)!;
      hits.push({
        rowIndex,
        sheetRow: rowIndex + 2,
        key,
        firstOccurrenceIndex: first,
      });
      excludedRowIndexes.add(rowIndex);
      multiKeys.add(key);
    } else {
      firstSeen.set(key, rowIndex);
    }
  });

  return {
    hits,
    duplicateCount: hits.length,
    excludedRowIndexes,
    duplicateKeys: Array.from(multiKeys),
  };
}

export interface DuplicateDetectorProps {
  headers: string[];
  rows: string[][];
  excludeDuplicates: boolean;
  onExcludeDuplicatesChange: (value: boolean) => void;
}

/**
 * UI: badge + checkbox for excluding duplicate rows from the import batch.
 */
export function DuplicateDetector({
  headers,
  rows,
  excludeDuplicates,
  onExcludeDuplicatesChange,
}: DuplicateDetectorProps) {
  const detection = useMemo(
    () => detectDuplicateRows(headers, rows),
    [headers, rows]
  );

  if (detection.duplicateCount === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
      data-testid="duplicate-detector"
    >
      <span
        className="inline-flex items-center rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900"
        data-testid="duplicate-count-badge"
      >
        {detection.duplicateCount} duplicate
        {detection.duplicateCount === 1 ? '' : 's'}
      </span>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-900">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-amber-400 text-amber-700 focus:ring-amber-500"
          checked={excludeDuplicates}
          onChange={(e) => onExcludeDuplicatesChange(e.target.checked)}
          data-testid="exclude-duplicates-checkbox"
        />
        Exclude Duplicates
      </label>
      <span className="text-xs text-amber-800">
        Rows sharing the same site/service id and start time
        {excludeDuplicates
          ? ' — later copies will be skipped on import.'
          : ' — enable to keep only the first occurrence of each pair.'}
      </span>
    </div>
  );
}

export default DuplicateDetector;
