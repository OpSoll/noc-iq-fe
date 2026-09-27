'use client';

/**
 * Wizard step that maps the columns of an imported CSV onto the import
 * schema. Real world exports rarely ship the snake_case schema names, so
 * every schema field gets a dropdown and the user decides which header
 * feeds it. The mapping is auto-detected first (exact match, then a small
 * alias table) and the step cannot be completed while a mandatory field is
 * still unmapped.
 *
 * The step is fully controlled: the parent owns the mapping, so a change
 * here is a single `setState` that re-validates the preview.
 *
 * Closes #626 - Bulk Import: Implement client-side CSV column mapping wizard
 */

import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Domain types ────────────────────────────────────────────────────────────

export interface ColumnFieldSpec {
  /** Schema field id, e.g. `service_id`. */
  id: string;
  /** Human readable label shown next to the dropdown. */
  label: string;
  /** Mandatory fields block the wizard until they are mapped. */
  required: boolean;
}

/** Field id -> picked header (empty string means "not mapped"). */
export type ColumnMapping = Record<string, string>;

/**
 * Header spellings seen in the wild per schema field. Keys are already in
 * `normalizeHeader` form, so lookups stay a plain `includes`.
 */
export const COLUMN_HEADER_ALIASES: Record<string, string[]> = {
  service_id: [
    'service_id',
    'service',
    'service_name',
    'affected_service',
    'component',
    'component_name',
    'asset',
  ],
  start_time: [
    'start_time',
    'start',
    'start_date',
    'started_at',
    'start_timestamp',
    'detected_at',
    'began_at',
    'outage_start',
  ],
  end_time: [
    'end_time',
    'end',
    'end_date',
    'ended_at',
    'end_timestamp',
    'resolved_at',
    'recovered_at',
    'restored_at',
    'outage_end',
  ],
};

// ─── Header normalisation ────────────────────────────────────────────────────

/**
 * Folds a CSV header into a comparable key: lowercased, camelCase split and
 * every run of non-alphanumerics collapsed into a single underscore.
 *
 *   'Start Time'  -> 'start_time'
 *   'Service ID'  -> 'service_id'
 *   'startTime'   -> 'start_time'
 */
export function normalizeHeader(header: string): string {
  return header
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('_');
}

// ─── Auto detection ──────────────────────────────────────────────────────────

/**
 * Best-effort mapping of schema fields onto headers: an exact match on the
 * field id or label first, then the alias table. Anything left over stays
 * unassigned so the user can pick it manually. Headers are matched by text,
 * so a file with duplicate header names maps both to the first occurrence.
 */
export function autoDetectMapping(
  headers: string[],
  fields: ColumnFieldSpec[]
): ColumnMapping {
  const mapping: ColumnMapping = {};
  const claimed = new Set<string>();

  function claim(field: ColumnFieldSpec, candidates: string[]): void {
    if (mapping[field.id]) return;

    for (const header of headers) {
      if (claimed.has(header)) continue;
      if (!candidates.includes(normalizeHeader(header))) continue;

      mapping[field.id] = header;
      claimed.add(header);
      return;
    }
  }

  for (const field of fields) {
    mapping[field.id] = '';
    claim(field, [normalizeHeader(field.id), normalizeHeader(field.label)]);
  }

  for (const field of fields) {
    claim(field, COLUMN_HEADER_ALIASES[field.id] ?? []);
  }

  return mapping;
}

// ─── Mapping helpers ─────────────────────────────────────────────────────────

/** Field ids that are mandatory but still unmapped. */
export function missingRequiredFields(
  fields: ColumnFieldSpec[],
  mapping: ColumnMapping
): string[] {
  return fields
    .filter((field) => field.required && !mapping[field.id])
    .map((field) => field.id);
}

/**
 * Renames the mapped header columns to their schema field id and returns the
 * row records untouched, since the mapping only re-labels columns. Callers
 * validate the returned headers, which is what lets a non-standard file pass
 * `validateCSV` unchanged.
 */
export function applyColumnMapping(
  headers: string[],
  records: string[][],
  mapping: ColumnMapping
): { headers: string[]; rows: string[][] } {
  const indexByHeader = new Map<string, number>();

  headers.forEach((header, index) => {
    if (!indexByHeader.has(header)) indexByHeader.set(header, index);
  });

  const renamed = [...headers];

  for (const [fieldId, header] of Object.entries(mapping)) {
    if (!header) continue;

    const index = indexByHeader.get(header);
    if (index === undefined) continue;

    renamed[index] = fieldId;
  }

  return { headers: renamed, rows: records };
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ColumnMapperProps {
  /** Header row of the parsed CSV. */
  headers: string[];
  /** Schema fields the user has to map onto `headers`. */
  fields: ColumnFieldSpec[];
  /** Current field id -> header mapping. */
  mapping: ColumnMapping;
  /** Fires on every change with the full mapping. */
  onMappingChange: (mapping: ColumnMapping) => void;
  /** Fires once nothing mandatory is missing. */
  onContinue: () => void;
  /** Extra classes for the wrapper. */
  className?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * ColumnMapper
 *
 * One labelled dropdown per schema field, driven by the `mapping` the parent
 * holds. Pressing continue while a mandatory field is still unmapped shows an
 * inline error instead of advancing the wizard, and the offending select is
 * flagged with `aria-invalid`.
 */
export function ColumnMapper({
  headers,
  fields,
  mapping,
  onMappingChange,
  onContinue,
  className,
}: ColumnMapperProps) {
  const [attempted, setAttempted] = useState(false);
  const baseId = useId();

  const missing = missingRequiredFields(fields, mapping);
  const showInlineError = attempted && missing.length > 0;

  function handleChange(fieldId: string, header: string) {
    const next: ColumnMapping = { ...mapping, [fieldId]: header };

    // A header can only feed one field: take it away from whoever had it.
    for (const [otherId, otherHeader] of Object.entries(next)) {
      if (otherId !== fieldId && header && otherHeader === header) {
        next[otherId] = '';
      }
    }

    onMappingChange(next);
    setAttempted(false);
  }

  function handleContinue() {
    if (missing.length > 0) {
      setAttempted(true);
      return;
    }

    setAttempted(false);
    onContinue();
  }

  return (
    <section
      className={cn('space-y-4 rounded-lg border bg-white p-4', className)}
      aria-label="Column mapping"
    >
      <header className="space-y-1">
        <h2 className="text-sm font-semibold text-gray-800">Column mapping</h2>
        <p className="text-xs text-gray-500">
          Match each column to an outage field. Required fields are marked with
          an asterisk.
        </p>
      </header>

      <div className="space-y-3">
        {fields.map((field) => {
          const selectId = `${baseId}-${field.id}`;
          const isMissing = field.required && !mapping[field.id];

          return (
            <div key={field.id} className="space-y-1">
              <label
                htmlFor={selectId}
                className="block text-xs font-medium text-gray-700"
              >
                {field.label}
                {field.required && (
                  <span className="ml-0.5 text-red-500" aria-hidden="true">
                    *
                  </span>
                )}
                {field.required && <span className="sr-only"> (required)</span>}
              </label>
              <select
                id={selectId}
                value={mapping[field.id] ?? ''}
                onChange={(event) => handleChange(field.id, event.target.value)}
                aria-invalid={isMissing || undefined}
                aria-describedby={
                  showInlineError && isMissing ? `${baseId}-error` : undefined
                }
                className={cn(
                  'w-full rounded-md border bg-white px-3 py-2 text-sm',
                  'text-gray-700 focus:outline-none focus:ring-2',
                  'focus:ring-blue-500 focus:ring-offset-1',
                  isMissing ? 'border-red-400' : 'border-gray-300'
                )}
              >
                <option value="">Not mapped</option>
                {headers.map((header, index) => (
                  <option key={`${header}-${index}`} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        Mapped {fields.length - missing.length} of {fields.length} columns
      </p>

      {showInlineError && (
        <p
          id={`${baseId}-error`}
          role="alert"
          className={cn(
            'rounded-md border border-red-200 bg-red-50 px-3 py-2',
            'text-xs text-red-700'
          )}
        >
          Map every required column to continue. Still missing:{' '}
          {missing.join(', ')}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" onClick={handleContinue}>
          Continue to validation
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
