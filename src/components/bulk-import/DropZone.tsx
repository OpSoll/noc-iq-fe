'use client';

/**
 * DropZone
 *
 * Drag-and-drop target for bulk import files, extracted out of
 * `bulk-import-view.tsx`. It owns the drop highlight, the file
 * extension / size validation and the file picker, so all three are
 * unit testable without mounting the whole wizard.
 *
 * Closes #625 - Bulk Import: Add CSV file drag-and-drop zone with format
 * validation
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';

import { cn } from '@/lib/utils';

// ─── Constants ───────────────────────────────────────────────────────────────

/** File extensions the import endpoint accepts. */
export const ACCEPTED_EXTENSIONS = ['.csv', '.json'] as const;

/** Hard ceiling for a single import file. */
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ACCEPTED_MIME_TYPES = ['text/csv', 'application/json'] as const;

// ─── Domain types ────────────────────────────────────────────────────────────

export type ImportFileCheck =
  | { ok: true }
  | { ok: false; message: string };

export interface DropZoneProps {
  /** Receives the file once it passed validation. */
  onFileSelected: (file: File) => void;
  /** Receives a user-facing message when validation fails. */
  onError?: (message: string) => void;
  /** Blocks drag & drop and the file picker while an import is running. */
  disabled?: boolean;
  /** Extra classes for the outer drop zone element. */
  className?: string;
}

// ─── File validation ─────────────────────────────────────────────────────────

function getExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function isAcceptedFile(file: File): boolean {
  const extensions: readonly string[] = ACCEPTED_EXTENSIONS;
  const mimeTypes: readonly string[] = ACCEPTED_MIME_TYPES;

  return (
    extensions.includes(getExtension(file.name)) ||
    mimeTypes.includes(file.type)
  );
}

/**
 * Pure guard for a candidate import file: extension / mime allowlist first,
 * then the 10MB ceiling, then a non-empty check. Returns the message to show
 * instead of the file so callers never have to re-implement the copy.
 */
export function validateImportFile(file: File): ImportFileCheck {
  if (!isAcceptedFile(file)) {
    return {
      ok: false,
      message: `Invalid file type. Accepted formats: ${ACCEPTED_EXTENSIONS.join(
        ', '
      )}`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      message: `File too large. Maximum size: ${MAX_FILE_SIZE_MB}MB`,
    };
  }

  if (file.size === 0) {
    return { ok: false, message: 'File is empty.' };
  }

  return { ok: true };
}

// ─── Drag helpers ────────────────────────────────────────────────────────────

/** True when the drag payload carries OS files rather than text or a URL. */
function isFileDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;

  if (!types) return false;

  return Array.from(types).includes('Files');
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * DropZone
 *
 * Renders the dashed drop target. Files dropped anywhere on the window (not
 * just on the dashed border) highlight the zone, and a file landing on the
 * browser default - which would navigate away and lose the form - is
 * suppressed. Clicking the `browse` label, or pressing Enter/Space on the
 * zone, opens the native file picker.
 */
export function DropZone({
  onFileSelected,
  onError,
  disabled = false,
  className,
}: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const inputId = `bulk-import-file-${useId()}`;

  // Suppress the browser's "open the dropped file" default for the whole
  // window and light the zone up as soon as a file enters the viewport.
  useEffect(() => {
    if (disabled) return;

    function handleWindowDragOver(event: DragEvent) {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      setDragging(true);
    }

    function handleWindowDragLeave(event: DragEvent) {
      // `relatedTarget` is null once the pointer leaves the window.
      if (event.relatedTarget === null) setDragging(false);
    }

    function handleWindowDrop() {
      setDragging(false);
    }

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [disabled]);

  // ─── Selection ─────────────────────────────────────────────────────────────

  const acceptFile = useCallback(
    (file: File) => {
      const check = validateImportFile(file);

      if (!check.ok) {
        onError?.(check.message);
        return;
      }

      onFileSelected(file);
    },
    [onError, onFileSelected]
  );

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextFile = event.target.files?.[0];

      if (nextFile) acceptFile(nextFile);

      // Reset so picking the same file twice still fires `change`.
      event.target.value = '';
    },
    [acceptFile]
  );

  // ─── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (isFileDrag(event.nativeEvent)) setDragging(true);
    },
    []
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      // Ignore bubbling from a child, only react to leaving the zone.
      const related = event.relatedTarget as Node | null;

      if (related && zoneRef.current?.contains(related)) return;

      setDragging(false);
    },
    []
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragging(false);

      if (disabled) return;

      const files = event.dataTransfer?.files;

      if (!files || files.length === 0) return;

      if (files.length > 1) {
        onError?.('Please upload only one file at a time.');
        return;
      }

      acceptFile(files[0]);
    },
    [acceptFile, disabled, onError]
  );

  // ─── Keyboard / click ──────────────────────────────────────────────────────

  const handleZoneClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // The `browse` label already activates the input; clicking it must
      // not open a second file dialog.
      const target = event.target as HTMLElement;

      if (target.tagName === 'INPUT' || target.closest('label')) return;

      openPicker();
    },
    [openPicker]
  );

  const handleZoneKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Keys pressed inside the picker input are left to the browser.
      if (event.target !== event.currentTarget) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;

      event.preventDefault();
      openPicker();
    },
    [openPicker]
  );

  return (
    <div
      ref={zoneRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleZoneClick}
      onKeyDown={handleZoneKeyDown}
      role="button"
      tabIndex={0}
      aria-disabled={disabled || undefined}
      aria-label="File upload dropzone. Click or press Enter to browse files."
      data-dragging={dragging}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center',
        'rounded-xl border-2 border-dashed p-10 transition-colors',
        'focus:outline-none focus:ring-2',
        'focus:ring-blue-500 focus:ring-offset-2',
        dragging
          ? 'border-blue-500 bg-blue-100'
          : 'border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50',
        disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        className
      )}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="peer sr-only"
        onChange={handleInputChange}
        aria-label="Choose file"
        disabled={disabled}
      />

      <Upload className="mb-3 h-10 w-10 text-gray-400" aria-hidden="true" />

      <label
        htmlFor={inputId}
        className={cn(
          'cursor-pointer text-sm font-medium text-gray-600',
          'peer-focus-visible:rounded peer-focus-visible:ring-2',
          'peer-focus-visible:ring-blue-500'
        )}
      >
        Drag and drop or{' '}
        <span className="text-blue-600 underline">browse</span>
      </label>

      <p className="mt-1 text-xs text-gray-400">
        Accepted formats: {ACCEPTED_EXTENSIONS.join(', ')} (max{' '}
        {MAX_FILE_SIZE_MB}MB)
      </p>
    </div>
  );
}
