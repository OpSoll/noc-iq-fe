import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import {
  ColumnMapper,
  autoDetectMapping,
  normalizeHeader,
  applyColumnMapping,
  missingRequiredFields,
  type ColumnFieldSpec,
} from './ColumnMapper';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const FIELDS: ColumnFieldSpec[] = [
  { id: 'service_id', label: 'Service ID', required: true },
  { id: 'start_time', label: 'Start Time', required: true },
  { id: 'end_time', label: 'End Time', required: true },
  { id: 'title', label: 'Title', required: false },
];

const HEADERS = ['Service ID', 'Start Time', 'End Time', 'Notes'];

// ─── normalizeHeader ─────────────────────────────────────────────────────────

describe('normalizeHeader', () => {
  it('lowercases and joins words with underscores', () => {
    expect(normalizeHeader('Start Time')).toBe('start_time');
  });

  it('collapses any run of separators into a single underscore', () => {
    expect(normalizeHeader('  Service   ID  ')).toBe('service_id');
    expect(normalizeHeader('service-id')).toBe('service_id');
    expect(normalizeHeader('service.id')).toBe('service_id');
  });

  it('splits camelCase headers', () => {
    expect(normalizeHeader('startTime')).toBe('start_time');
    expect(normalizeHeader('serviceID')).toBe('service_id');
  });

  it('returns an empty key for a header with no alphanumerics', () => {
    expect(normalizeHeader('---')).toBe('');
  });
});

// ─── autoDetectMapping ───────────────────────────────────────────────────────

describe('autoDetectMapping', () => {
  it('matches the schema field id exactly', () => {
    const mapping = autoDetectMapping(
      ['service_id', 'notes'],
      FIELDS.slice(0, 1)
    );

    expect(mapping.service_id).toBe('service_id');
  });

  it("maps 'Start Time' onto start_time", () => {
    const mapping = autoDetectMapping(HEADERS, FIELDS);

    expect(mapping).toMatchObject({
      service_id: 'Service ID',
      start_time: 'Start Time',
      end_time: 'End Time',
      title: '',
    });
  });

  it('falls back to the alias table for non-standard headers', () => {
    const mapping = autoDetectMapping(
      ['Service', 'Detected At', 'Recovered At'],
      FIELDS.slice(0, 3)
    );

    expect(mapping).toEqual({
      service_id: 'Service',
      start_time: 'Detected At',
      end_time: 'Recovered At',
    });
  });

  it('never assigns one header to two fields', () => {
    const mapping = autoDetectMapping(['service_id', 'service_id'], FIELDS);

    expect(mapping.service_id).toBe('service_id');
    expect(mapping.start_time).toBe('');
  });

  it('leaves unknown headers unassigned', () => {
    const mapping = autoDetectMapping(['mystery'], FIELDS.slice(0, 1));

    expect(mapping.service_id).toBe('');
  });
});

// ─── applyColumnMapping ──────────────────────────────────────────────────────

describe('applyColumnMapping', () => {
  it('renames mapped headers to their schema field id', () => {
    const mapped = applyColumnMapping(
      HEADERS,
      [['api', '2026-01-01', '2026-01-02', 'note']],
      {
        service_id: 'Service ID',
        start_time: 'Start Time',
        end_time: 'End Time',
        title: '',
      }
    );

    expect(mapped.headers).toEqual([
      'service_id',
      'start_time',
      'end_time',
      'Notes',
    ]);
    expect(mapped.rows).toEqual([
      ['api', '2026-01-01', '2026-01-02', 'note'],
    ]);
  });

  it('leaves unmapped columns untouched', () => {
    const mapped = applyColumnMapping(HEADERS, [], {});

    expect(mapped.headers).toEqual(HEADERS);
  });

  it('ignores a mapped header that is not in the file', () => {
    const mapped = applyColumnMapping(['Start Time'], [], {
      start_time: 'Missing Header',
    });

    expect(mapped.headers).toEqual(['Start Time']);
  });
});

// ─── missingRequiredFields ───────────────────────────────────────────────────

describe('missingRequiredFields', () => {
  it('lists only unmapped mandatory fields', () => {
    const missing = missingRequiredFields(FIELDS, {
      service_id: 'Service ID',
      start_time: '',
      end_time: '',
      title: '',
    });

    expect(missing).toEqual(['start_time', 'end_time']);
  });
});

// ─── ColumnMapper ────────────────────────────────────────────────────────────

/** Mapping the parent would have produced for HEADERS. */
const AUTO_MAPPING = autoDetectMapping(HEADERS, FIELDS);

function setup(props: Partial<ComponentProps<typeof ColumnMapper>> = {}) {
  const onMappingChange = vi.fn();
  const onContinue = vi.fn();

  const view = render(
    <ColumnMapper
      headers={HEADERS}
      fields={FIELDS}
      mapping={AUTO_MAPPING}
      onMappingChange={onMappingChange}
      onContinue={onContinue}
      {...props}
    />
  );

  return { onMappingChange, onContinue, ...view };
}

describe('ColumnMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a labelled dropdown for every schema field', () => {
    setup();

    expect(screen.getByLabelText(/Service ID/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start Time/)).toBeInTheDocument();
    expect(screen.getByLabelText(/End Time/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Title/)).toBeInTheDocument();
  });

  it('pre-selects the header the parent mapped to each field', () => {
    setup();

    expect(screen.getByLabelText(/Service ID/)).toHaveValue('Service ID');
    expect(screen.getByLabelText(/Start Time/)).toHaveValue('Start Time');
  });

  it('emits the full mapping whenever a dropdown changes', async () => {
    const user = userEvent.setup();
    const { onMappingChange } = setup();

    await user.selectOptions(screen.getByLabelText(/Title/), 'Notes');

    expect(onMappingChange).toHaveBeenCalledWith({
      service_id: 'Service ID',
      start_time: 'Start Time',
      end_time: 'End Time',
      title: 'Notes',
    });
  });

  it('frees a header when another field claims it', () => {
    const { onMappingChange } = setup();

    fireEvent.change(screen.getByLabelText(/Title/), {
      target: { value: 'Service ID' },
    });

    expect(onMappingChange).toHaveBeenCalledWith({
      service_id: '',
      start_time: 'Start Time',
      end_time: 'End Time',
      title: 'Service ID',
    });
  });

  it('continues with the mapping when every field is mapped', async () => {
    const user = userEvent.setup();
    const { onContinue } = setup();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('blocks with an inline error while a field is unmapped', async () => {
    const user = userEvent.setup();
    const { onContinue } = setup({
      mapping: { ...AUTO_MAPPING, end_time: '' },
    });

    expect(
      screen.queryByText(/Map every required column/)
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /continue/i }));

    expect(onContinue).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Map every required column to continue/)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/End Time/)).toHaveAttribute(
      'aria-invalid',
      'true'
    );
  });

  it('clears the inline error once the parent remaps the field', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    const { rerender } = setup({
      mapping: { ...AUTO_MAPPING, end_time: '' },
      onContinue,
    });

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // The parent applies the fix, which also dismisses the guard rail.
    rerender(
      <ColumnMapper
        headers={HEADERS}
        fields={FIELDS}
        mapping={AUTO_MAPPING}
        onMappingChange={vi.fn()}
        onContinue={onContinue}
      />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/End Time/)).toHaveValue('End Time');
  });

  it('follows the mapping when a different file is loaded', () => {
    const onContinue = vi.fn();
    const headers = ['Component', 'Started At', 'Resolved At'];
    const fields = FIELDS.slice(0, 3);
    const { rerender } = setup({
      headers,
      fields,
      mapping: autoDetectMapping(headers, fields),
      onContinue,
    });

    expect(screen.getByLabelText(/Service ID/)).toHaveValue('Component');

    // Selecting another file swaps the headers and the mapping together.
    const nextHeaders = ['System', 'Began At', 'Finished At'];
    rerender(
      <ColumnMapper
        headers={nextHeaders}
        fields={fields}
        mapping={autoDetectMapping(nextHeaders, fields)}
        onMappingChange={vi.fn()}
        onContinue={onContinue}
      />
    );

    expect(screen.getByLabelText(/Service ID/)).toHaveValue('System');
    expect(screen.getByLabelText(/Start Time/)).toHaveValue('Began At');
    expect(screen.getByLabelText(/End Time/)).toHaveValue('Finished At');
  });

  it('renders a single enabled action to advance the step', () => {
    setup();

    expect(
      screen.getByRole('button', { name: /continue to validation/i })
    ).toBeEnabled();
  });
});
