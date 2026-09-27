import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { FileQueue, useFileQueue } from "@/components/bulk-import/FileQueue";
import type { BulkImportResult } from "@/types/bulkImport";

const csv = (name: string) =>
  new File(["service_id,start_time,end_time\ns1,2026-01-01,2026-01-02"], name, {
    type: "text/csv",
  });

const ok = (imported = 1): BulkImportResult => ({
  imported,
  skipped: 0,
  errors: [],
});

/** A processor whose completion is controlled by the test. */
function deferredProcessor() {
  const calls: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const resolvers: Array<(result: BulkImportResult) => void> = [];

  const processFile = vi.fn((file: File) => {
    calls.push(file.name);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);

    return new Promise<BulkImportResult>((resolve) => {
      resolvers.push((result) => {
        inFlight -= 1;
        resolve(result);
      });
    });
  });

  return {
    processFile,
    calls,
    get maxInFlight() {
      return maxInFlight;
    },
    get pending() {
      return resolvers.length;
    },
    async settleNext(result: BulkImportResult = ok()) {
      const next = resolvers.shift();
      if (!next) throw new Error("nothing in flight");
      await act(async () => {
        next(result);
      });
    },
  };
}

/**
 * Issue #636 — multi-file bulk import queue.
 *
 * The behaviour worth pinning is that files are processed strictly one at a
 * time. Everything else in the issue is visible in the markup; that one is
 * invisible and is the reason the queue exists, so it is asserted by watching
 * how many processor calls are ever in flight at once.
 */
describe("useFileQueue", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => useFileQueue({ processFile: vi.fn() }));

    expect(result.current.items).toEqual([]);
    expect(result.current.counts.total).toBe(0);
    expect(result.current.isProcessing).toBe(false);
  });

  it("queues several files at once, preserving order", () => {
    const { result } = renderHook(() => useFileQueue({ processFile: vi.fn() }));

    act(() => result.current.enqueue([csv("north.csv"), csv("south.csv")]));

    expect(result.current.items.map((i) => i.file.name)).toEqual([
      "north.csv",
      "south.csv",
    ]);
    expect(result.current.items.every((i) => i.status === "queued")).toBe(true);
  });

  it("keeps two files with the same name apart", () => {
    const { result } = renderHook(() => useFileQueue({ processFile: vi.fn() }));

    act(() => result.current.enqueue([csv("region.csv"), csv("region.csv")]));

    const [first, second] = result.current.items;
    // Ids, not filenames, identify a queue entry.
    expect(first.id).not.toBe(second.id);
  });

  it("ignores an empty selection", () => {
    const { result } = renderHook(() => useFileQueue({ processFile: vi.fn() }));

    act(() => result.current.enqueue([]));

    expect(result.current.items).toEqual([]);
  });

  it("processes files one at a time, never concurrently", async () => {
    const processor = deferredProcessor();
    const { result } = renderHook(() =>
      useFileQueue({ processFile: processor.processFile }),
    );

    act(() =>
      result.current.enqueue([csv("a.csv"), csv("b.csv"), csv("c.csv")]),
    );
    act(() => {
      void result.current.start();
    });

    // Only the first file has been handed to the processor.
    await waitFor(() => expect(processor.calls).toEqual(["a.csv"]));
    expect(result.current.items[0].status).toBe("processing");
    expect(result.current.items[1].status).toBe("queued");

    await processor.settleNext();
    await waitFor(() => expect(processor.calls).toEqual(["a.csv", "b.csv"]));

    await processor.settleNext();
    await waitFor(() =>
      expect(processor.calls).toEqual(["a.csv", "b.csv", "c.csv"]),
    );

    await processor.settleNext();
    await waitFor(() => expect(result.current.isProcessing).toBe(false));

    // The whole point of the queue.
    expect(processor.maxInFlight).toBe(1);
  });

  it("records a result per file", async () => {
    const processor = deferredProcessor();
    const { result } = renderHook(() =>
      useFileQueue({ processFile: processor.processFile }),
    );

    act(() => result.current.enqueue([csv("a.csv"), csv("b.csv")]));
    act(() => {
      void result.current.start();
    });

    await waitFor(() => expect(processor.pending).toBe(1));
    await processor.settleNext(ok(10));
    await waitFor(() => expect(processor.pending).toBe(1));
    await processor.settleNext(ok(5));

    await waitFor(() => expect(result.current.isProcessing).toBe(false));
    expect(result.current.items[0].result?.imported).toBe(10);
    expect(result.current.items[1].result?.imported).toBe(5);
  });

  it("carries on after a file fails", async () => {
    const processFile = vi
      .fn()
      .mockRejectedValueOnce(new Error("Row 4: bad timestamp"))
      .mockResolvedValueOnce(ok());

    const { result } = renderHook(() => useFileQueue({ processFile }));

    act(() => result.current.enqueue([csv("bad.csv"), csv("good.csv")]));
    await act(async () => {
      await result.current.start();
    });

    // A single bad regional file must not abandon the rest of the import.
    expect(result.current.items[0].status).toBe("failed");
    expect(result.current.items[0].error).toBe("Row 4: bad timestamp");
    expect(result.current.items[1].status).toBe("succeeded");
    expect(result.current.counts).toMatchObject({ succeeded: 1, failed: 1 });
  });

  it("picks up a file added while the queue is draining", async () => {
    const processor = deferredProcessor();
    const { result } = renderHook(() =>
      useFileQueue({ processFile: processor.processFile }),
    );

    act(() => result.current.enqueue([csv("a.csv")]));
    act(() => {
      void result.current.start();
    });
    await waitFor(() => expect(processor.calls).toEqual(["a.csv"]));

    // Dropped in mid-run; the run in progress should take it.
    act(() => result.current.enqueue([csv("late.csv")]));
    await processor.settleNext();

    await waitFor(() => expect(processor.calls).toEqual(["a.csv", "late.csv"]));
    await processor.settleNext();
    await waitFor(() => expect(result.current.isProcessing).toBe(false));
  });

  it("does not start a second worker", async () => {
    const processor = deferredProcessor();
    const { result } = renderHook(() =>
      useFileQueue({ processFile: processor.processFile }),
    );

    act(() => result.current.enqueue([csv("a.csv"), csv("b.csv")]));
    act(() => {
      void result.current.start();
      void result.current.start();
      void result.current.start();
    });

    await waitFor(() => expect(processor.calls).toEqual(["a.csv"]));
    expect(processor.maxInFlight).toBe(1);
  });

  it("removes a queued file but not one being processed", async () => {
    const processor = deferredProcessor();
    const { result } = renderHook(() =>
      useFileQueue({ processFile: processor.processFile }),
    );

    act(() => result.current.enqueue([csv("a.csv"), csv("b.csv")]));
    act(() => {
      void result.current.start();
    });
    await waitFor(() => expect(result.current.items[0].status).toBe("processing"));

    const [processing, queued] = result.current.items;

    act(() => result.current.remove(queued.id));
    expect(result.current.items).toHaveLength(1);

    // Removing an in-flight upload would leave the backend mid-import with
    // nothing tracking it.
    act(() => result.current.remove(processing.id));
    expect(result.current.items).toHaveLength(1);
  });

  it("clears finished files and keeps the rest", async () => {
    const processFile = vi.fn().mockResolvedValue(ok());
    const { result } = renderHook(() => useFileQueue({ processFile }));

    act(() => result.current.enqueue([csv("a.csv")]));
    await act(async () => {
      await result.current.start();
    });
    act(() => result.current.enqueue([csv("b.csv")]));

    act(() => result.current.clearFinished());

    expect(result.current.items.map((i) => i.file.name)).toEqual(["b.csv"]);
  });

  it("reports completion once the queue drains", async () => {
    const onQueueComplete = vi.fn();
    const processFile = vi.fn().mockResolvedValue(ok());
    const { result } = renderHook(() =>
      useFileQueue({ processFile, onQueueComplete }),
    );

    act(() => result.current.enqueue([csv("a.csv"), csv("b.csv")]));
    await act(async () => {
      await result.current.start();
    });

    expect(onQueueComplete).toHaveBeenCalledTimes(1);
    expect(onQueueComplete.mock.calls[0][0]).toHaveLength(2);
  });

  it("does nothing when started with an empty queue", async () => {
    const processFile = vi.fn();
    const { result } = renderHook(() => useFileQueue({ processFile }));

    await act(async () => {
      await result.current.start();
    });

    expect(processFile).not.toHaveBeenCalled();
  });
});

describe("FileQueue", () => {
  function fileInput() {
    return document.querySelector("input[type='file']") as HTMLInputElement;
  }

  it("accepts multiple files on the drop zone input", () => {
    render(<FileQueue processFile={vi.fn()} />);

    expect(fileInput()).toHaveAttribute("multiple");
    expect(fileInput().getAttribute("accept")).toContain(".csv");
  });

  it("lists every selected file as queued", () => {
    render(<FileQueue processFile={vi.fn()} />);

    fireEvent.change(fileInput(), {
      target: { files: [csv("north.csv"), csv("south.csv")] },
    });

    expect(screen.getByText("north.csv")).toBeInTheDocument();
    expect(screen.getByText("south.csv")).toBeInTheDocument();
    expect(screen.getAllByText("Queued")).toHaveLength(2);
  });

  it("queues files that are dropped", () => {
    render(<FileQueue processFile={vi.fn()} />);

    fireEvent.drop(screen.getByText(/Drop CSV files here/i).closest("div")!, {
      dataTransfer: { files: [csv("dropped.csv")] },
    });

    expect(screen.getByText("dropped.csv")).toBeInTheDocument();
  });

  it("updates each file indicator as the queue runs", async () => {
    const processor = deferredProcessor();
    render(<FileQueue processFile={processor.processFile} />);

    fireEvent.change(fileInput(), {
      target: { files: [csv("a.csv"), csv("b.csv")] },
    });
    fireEvent.click(screen.getByRole("button", { name: /start import/i }));

    await waitFor(() => expect(screen.getByText("Importing")).toBeInTheDocument());
    expect(screen.getByText("Queued")).toBeInTheDocument();

    await processor.settleNext();
    await waitFor(() => expect(screen.getByText("Imported")).toBeInTheDocument());

    await processor.settleNext();
    await waitFor(() =>
      expect(screen.getAllByText("Imported")).toHaveLength(2),
    );
  });

  it("shows the failure reason against the file that failed", async () => {
    const processFile = vi.fn().mockRejectedValue(new Error("Malformed header"));
    render(<FileQueue processFile={processFile} />);

    fireEvent.change(fileInput(), { target: { files: [csv("bad.csv")] } });
    fireEvent.click(screen.getByRole("button", { name: /start import/i }));

    expect(await screen.findByText("Malformed header")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("keeps the start button disabled until something is queued", () => {
    render(<FileQueue processFile={vi.fn()} />);

    // Nothing queued yet, so the control is not rendered at all.
    expect(screen.queryByRole("button", { name: /start import/i })).toBeNull();

    fireEvent.change(fileInput(), { target: { files: [csv("a.csv")] } });
    expect(screen.getByRole("button", { name: /start import/i })).toBeEnabled();
  });

  it("lets a queued file be removed", () => {
    render(<FileQueue processFile={vi.fn()} />);

    fireEvent.change(fileInput(), { target: { files: [csv("a.csv")] } });
    fireEvent.click(
      screen.getByRole("button", { name: /remove a\.csv from the queue/i }),
    );

    expect(screen.queryByText("a.csv")).toBeNull();
  });

  it("announces queue progress", async () => {
    const processFile = vi.fn().mockResolvedValue(ok());
    render(<FileQueue processFile={processFile} />);

    fireEvent.change(fileInput(), { target: { files: [csv("a.csv")] } });

    expect(screen.getByText(/1 file queued/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /start import/i }));
    // Scoped to the summary line; the per-file row also says "1 imported".
    await waitFor(() =>
      expect(screen.getByText(/1 imported · 0 failed/)).toBeInTheDocument(),
    );
  });
});
