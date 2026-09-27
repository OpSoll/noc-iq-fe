"use client";

import { useCallback, useId, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { bulkImportOutages } from "@/services/bulkImportService";
import type { BulkImportResult } from "@/types/bulkImport";

/** Lifecycle of one queued file. */
export type QueuedFileStatus = "queued" | "processing" | "succeeded" | "failed";

export interface QueuedFile {
  /** Stable id; a queue can legitimately hold two files with the same name. */
  id: string;
  file: File;
  status: QueuedFileStatus;
  error?: string;
  result?: BulkImportResult;
}

export interface UseFileQueueOptions {
  /** Processes one file. Injectable so the queue can be tested without a server. */
  processFile?: (file: File) => Promise<BulkImportResult>;
  /** Called once the queue drains. */
  onQueueComplete?: (items: QueuedFile[]) => void;
}

let queueIdCounter = 0;

function toQueued(file: File): QueuedFile {
  queueIdCounter += 1;
  return { id: `queued-${queueIdCounter}-${file.name}`, status: "queued", file };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Import failed.";
}

/**
 * Sequential multi-file import queue (issue #636).
 *
 * ## Why the queue is held in a ref as well as state
 *
 * Processing is an async loop, and a loop that closed over `items` from state
 * would read the value captured when it started — so a file dropped mid-run would
 * never be picked up, and two `enqueue` calls during a run could overwrite each
 * other. The ref is the single synchronously-readable source of truth and state
 * is the render mirror, updated together through {@link mutate}.
 *
 * ## Strictly sequential
 *
 * The point of the issue is that files are processed one at a time, so the loop
 * awaits each file before looking for the next, and `runningRef` makes a second
 * `start()` a no-op rather than a second worker. Uploading several regional CSVs
 * at once is exactly what the backend import is not built for.
 *
 * Re-reading the ref each iteration also means a file added while the queue is
 * draining is picked up by the run already in progress, instead of sitting there
 * until someone presses start again.
 *
 * @param options - Optional processor and completion callback.
 * @returns Queue state and its controls.
 */
export function useFileQueue({
  processFile = bulkImportOutages,
  onQueueComplete,
}: UseFileQueueOptions = {}) {
  const [items, setItems] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const itemsRef = useRef<QueuedFile[]>([]);
  const runningRef = useRef(false);

  const mutate = useCallback(
    (updater: (current: QueuedFile[]) => QueuedFile[]) => {
      itemsRef.current = updater(itemsRef.current);
      setItems(itemsRef.current);
    },
    [],
  );

  const patch = useCallback(
    (id: string, changes: Partial<QueuedFile>) => {
      mutate((current) =>
        current.map((item) => (item.id === id ? { ...item, ...changes } : item)),
      );
    },
    [mutate],
  );

  const enqueue = useCallback(
    (files: File[] | FileList) => {
      const incoming = Array.from(files);
      if (incoming.length === 0) return;
      mutate((current) => [...current, ...incoming.map(toQueued)]);
    },
    [mutate],
  );

  const remove = useCallback(
    (id: string) => {
      // Only a file that has not started can be removed; dropping one mid-upload
      // would leave the backend holding a partial import with nothing tracking it.
      mutate((current) =>
        current.filter((item) => !(item.id === id && item.status === "queued")),
      );
    },
    [mutate],
  );

  const clearFinished = useCallback(() => {
    mutate((current) =>
      current.filter(
        (item) => item.status === "queued" || item.status === "processing",
      ),
    );
  }, [mutate]);

  const start = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsProcessing(true);

    try {
      for (;;) {
        const next = itemsRef.current.find((item) => item.status === "queued");
        if (!next) break;

        patch(next.id, { status: "processing", error: undefined });

        try {
          const result = await processFile(next.file);
          patch(next.id, { status: "succeeded", result });
        } catch (error) {
          // One bad file must not abandon the rest of the queue — that is the
          // behaviour the sequential wizard had, and the reason this exists.
          patch(next.id, { status: "failed", error: errorMessage(error) });
        }
      }
    } finally {
      runningRef.current = false;
      setIsProcessing(false);
      onQueueComplete?.(itemsRef.current);
    }
  }, [onQueueComplete, patch, processFile]);

  const counts = {
    total: items.length,
    queued: items.filter((item) => item.status === "queued").length,
    processing: items.filter((item) => item.status === "processing").length,
    succeeded: items.filter((item) => item.status === "succeeded").length,
    failed: items.filter((item) => item.status === "failed").length,
  };

  return {
    items,
    counts,
    isProcessing,
    enqueue,
    remove,
    clearFinished,
    start,
  };
}

const STATUS_LABEL: Record<QueuedFileStatus, string> = {
  queued: "Queued",
  processing: "Importing",
  succeeded: "Imported",
  failed: "Failed",
};

function StatusIndicator({ status }: { status: QueuedFileStatus }) {
  const icon = {
    queued: <Clock className="h-4 w-4" aria-hidden="true" />,
    processing: (
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
    ),
    succeeded: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
    failed: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
  }[status];

  return (
    <span
      // Colour alone must not carry the status, so the label is always rendered.
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        status === "queued" && "text-muted-foreground",
        status === "processing" && "text-blue-600 dark:text-blue-400",
        status === "succeeded" && "text-green-600 dark:text-green-400",
        status === "failed" && "text-destructive",
      )}
    >
      {icon}
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface FileQueueProps extends UseFileQueueOptions {
  /** File types the drop zone accepts. */
  accept?: string;
  className?: string;
}

/**
 * Multi-file bulk import queue (issue #636).
 *
 * Accepts several CSVs at once by selection or drop, lists them, and imports them
 * one after another with a status per file — replacing the wizard flow where a
 * user had to wait for each regional file to finish before choosing the next.
 *
 * @param props - Optional processor, completion callback and accepted types.
 * @returns The drop zone and the queue list.
 */
export function FileQueue({
  accept = ".csv,text/csv",
  className,
  processFile,
  onQueueComplete,
}: FileQueueProps) {
  const {
    items,
    counts,
    isProcessing,
    enqueue,
    remove,
    clearFinished,
    start,
  } = useFileQueue({ processFile, onQueueComplete });

  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    enqueue(event.dataTransfer.files);
  };

  const hasQueued = counts.queued > 0;
  const hasFinished = counts.succeeded + counts.failed > 0;

  return (
    <section className={cn("space-y-4", className)} aria-label="Import queue">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border",
        )}
      >
        <UploadCloud
          className="mx-auto h-8 w-8 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm font-medium">
          Drop CSV files here, or select several at once
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Files are imported one at a time, in the order listed below.
        </p>

        <label htmlFor={inputId} className="sr-only">
          Choose CSV files to queue
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          multiple
          accept={accept}
          className="sr-only"
          onChange={(event) => {
            if (event.target.files) enqueue(event.target.files);
            // Reset so choosing the same file twice still fires a change event.
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => inputRef.current?.click()}
        >
          Select files
        </Button>
      </div>

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {counts.total} file{counts.total === 1 ? "" : "s"} queued ·{" "}
              {counts.succeeded} imported · {counts.failed} failed
            </p>
            <div className="flex gap-2">
              {hasFinished && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearFinished}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  Clear finished
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={start}
                disabled={isProcessing || !hasQueued}
              >
                {isProcessing ? "Importing…" : "Start import"}
              </Button>
            </div>
          </div>

          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {item.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(item.file.size)}
                    {item.result
                      ? ` · ${item.result.imported} imported, ${item.result.skipped} skipped`
                      : ""}
                  </p>
                  {item.error && (
                    <p className="mt-1 text-xs text-destructive">{item.error}</p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <StatusIndicator status={item.status} />
                  {item.status === "queued" && (
                    <button
                      type="button"
                      onClick={() => remove(item.id)}
                      aria-label={`Remove ${item.file.name} from the queue`}
                      className="rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export default FileQueue;
