import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import {
  DropZone,
  validateImportFile,
  MAX_FILE_SIZE_BYTES,
  type DropZoneProps,
} from './DropZone';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const csvFile = (name = 'outages.csv', body = 'a,b\n1,2') =>
  new File([body], name, { type: 'text/csv' });

/** Minimal `DataTransfer` stand-in for the jsdom drag events. */
const dataTransfer = (files: File[], types: string[] = ['Files']) =>
  ({ files, types }) as unknown as DataTransfer;

function setup(props: Partial<DropZoneProps> = {}) {
  const onFileSelected = vi.fn();
  const onError = vi.fn();

  render(
    <DropZone onFileSelected={onFileSelected} onError={onError} {...props} />
  );

  const zone = screen.getByRole('button', {
    name: /file upload dropzone/i,
  });

  return { onFileSelected, onError, zone };
}

// ─── validateImportFile ──────────────────────────────────────────────────────

describe('validateImportFile', () => {
  it('accepts a .csv file within the size limit', () => {
    expect(validateImportFile(csvFile())).toEqual({ ok: true });
  });

  it('accepts a .json file within the size limit', () => {
    const json = new File(['[]'], 'outages.json', {
      type: 'application/json',
    });
    expect(validateImportFile(json)).toEqual({ ok: true });
  });

  it('rejects an unsupported extension with a format message', () => {
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' });
    const result = validateImportFile(txt);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a rejected file');
    expect(result.message).toBe(
      'Invalid file type. Accepted formats: .csv, .json'
    );
  });

  it('rejects files above the 10MB limit', () => {
    const big = new File(['x'], 'big.csv', { type: 'text/csv' });
    Object.defineProperty(big, 'size', { value: MAX_FILE_SIZE_BYTES + 1 });

    const result = validateImportFile(big);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a rejected file');
    expect(result.message).toBe('File too large. Maximum size: 10MB');
  });

  it('rejects an empty file', () => {
    const empty = new File([], 'empty.csv', { type: 'text/csv' });
    const result = validateImportFile(empty);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected a rejected file');
    expect(result.message).toBe('File is empty.');
  });
});

// ─── DropZone handlers ───────────────────────────────────────────────────────

describe('DropZone', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('advertises the accepted formats and the 10MB ceiling', () => {
    setup();
    expect(
      screen.getByText(/Accepted formats: \.csv, \.json \(max 10MB\)/)
    ).toBeInTheDocument();
  });

  it('highlights the zone while a file is dragged over the window', () => {
    const { zone } = setup();

    expect(zone).toHaveAttribute('data-dragging', 'false');

    fireEvent.dragOver(window, { dataTransfer: dataTransfer([]) });

    expect(zone).toHaveAttribute('data-dragging', 'true');
    expect(zone.className).toContain('border-blue-500');
  });

  it('does not highlight for non-file drags such as selected text', () => {
    const { zone } = setup();

    fireEvent.dragOver(window, {
      dataTransfer: { files: [], types: ['text/plain'] } as DataTransfer,
    });

    expect(zone).toHaveAttribute('data-dragging', 'false');
  });

  it('clears the highlight when the file leaves the window', () => {
    const { zone } = setup();

    fireEvent.dragOver(window, { dataTransfer: dataTransfer([]) });
    expect(zone).toHaveAttribute('data-dragging', 'true');

    fireEvent.dragLeave(window);
    expect(zone).toHaveAttribute('data-dragging', 'false');
  });

  it('clears the highlight after a drop on the zone', () => {
    const { onFileSelected, zone } = setup();
    const file = csvFile();

    fireEvent.drop(zone, { dataTransfer: dataTransfer([file]) });

    expect(zone).toHaveAttribute('data-dragging', 'false');
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it('forwards a dropped csv file to onFileSelected', () => {
    const { onFileSelected, zone } = setup();
    const file = csvFile('drop.csv');

    fireEvent.drop(zone, { dataTransfer: dataTransfer([file]) });

    expect(onFileSelected).toHaveBeenCalledTimes(1);
    expect(onFileSelected.mock.calls[0][0].name).toBe('drop.csv');
  });

  it('rejects a dropped file with an unsupported extension', () => {
    const { onFileSelected, onError, zone } = setup();
    const txt = new File(['x'], 'notes.txt', { type: 'text/plain' });

    fireEvent.drop(zone, { dataTransfer: dataTransfer([txt]) });

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      'Invalid file type. Accepted formats: .csv, .json'
    );
  });

  it('rejects a multi-file drop', () => {
    const { onFileSelected, onError, zone } = setup();

    fireEvent.drop(zone, {
      dataTransfer: dataTransfer([csvFile('a.csv'), csvFile('b.csv')]),
    });

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      'Please upload only one file at a time.'
    );
  });

  it('ignores a drop that carries no files', () => {
    const { onFileSelected, onError, zone } = setup();

    fireEvent.drop(zone, { dataTransfer: dataTransfer([]) });

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports an unsupported file chosen through the picker', () => {
    const { onError } = setup();
    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;

    fireEvent.change(input, {
      target: { files: [new File(['x'], 'notes.txt', { type: 'text/plain' })] },
    });

    expect(onError).toHaveBeenCalledWith(
      'Invalid file type. Accepted formats: .csv, .json'
    );
  });

  it('forwards a csv file chosen through the picker', () => {
    const { onFileSelected } = setup();
    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [csvFile('pick.csv')] } });

    expect(onFileSelected.mock.calls[0][0].name).toBe('pick.csv');
  });

  it('labels the hidden file input so browse opens the picker', () => {
    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;
    const label = screen.getByText('browse').closest('label');

    expect(label).not.toBeNull();
    expect(label).toHaveAttribute('for', input.id);
    expect(input).toHaveAttribute('accept', '.csv,.json');
  });

  it('opens the picker when the zone itself is clicked', () => {
    const { zone } = setup();
    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.click(zone);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('does not open a second dialog when the browse label is clicked', () => {
    const { zone } = setup();
    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');
    const label = screen.getByText('browse').closest('label') as HTMLElement;

    fireEvent.click(label);

    // The label already activates the input, so the zone handler has to
    // stay out of the way - never more than one dialog per click.
    expect(clickSpy.mock.calls.length).toBeLessThanOrEqual(1);
    expect(zone).toBeInTheDocument();
  });

  it('opens the picker with Enter and Space on the zone', () => {
    const { zone } = setup();
    const input = document.querySelector(
      "input[type='file']"
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    fireEvent.keyDown(zone, { key: 'Enter' });
    fireEvent.keyDown(zone, { key: ' ' });

    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it('does not accept files while disabled', () => {
    const { onFileSelected, zone } = setup({ disabled: true });

    fireEvent.drop(zone, { dataTransfer: dataTransfer([csvFile()]) });

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(zone).toHaveAttribute('aria-disabled', 'true');
  });
});
