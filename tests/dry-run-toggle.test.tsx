import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DRY_RUN_SUCCESS_MESSAGE,
  DryRunToggle,
} from "@/components/bulk-import/DryRunToggle";
import type { BulkImportDryRunResult } from "@/types/bulkImport";

/**
 * The toast is mocked rather than rendered.
 *
 * ToastWithProgress animates a progress bar with a requestAnimationFrame loop
 * that calls setState on every frame for four seconds. Rendering a real toast in
 * jsdom therefore produces a continuous stream of updates, which made every
 * assertion after a toast fire slow enough to time out the vitest worker. What
 * this component owes the user is the right message and severity, so that is what
 * is asserted.
 */
// vi.hoisted, because vi.mock is lifted above ordinary const declarations: a
// factory closing over a plain `const toastSpy` reads it before initialisation.
const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }));

vi.mock("@/components/ui/toast", () => ({
  useToast: () => toastSpy,
}));

const file = () =>
  new File(["service_id,start_time,end_time\ns1,2026-01-01,2026-01-02"], "north.csv", {
    type: "text/csv",
  });

function report(
  overrides: Partial<BulkImportDryRunResult> = {},
): BulkImportDryRunResult {
  return { imported: 12, skipped: 2, errors: [], ...overrides };
}

function setup(props: Partial<React.ComponentProps<typeof DryRunToggle>> = {}) {
  const validateFile = props.validateFile ?? vi.fn().mockResolvedValue(report());

  render(<DryRunToggle file={file()} {...props} validateFile={validateFile} />);

  return { validateFile };
}

/** fireEvent rather than user-event, matching the existing tests in this repo. */
const clickToggle = () => fireEvent.click(toggle());
const clickRun = () =>
  fireEvent.click(screen.getByRole("button", { name: /run validation/i }));

beforeEach(() => toastSpy.mockReset());

const toggle = () => screen.getByRole("switch", { name: /dry run/i });

/** Every message passed to the toast during a test. */
const toastMessages = () => toastSpy.mock.calls.map((call) => String(call[0]));

/**
 * Issue #637 — dry-run (validate only) toggle.
 *
 * The interesting assertions are about the promise the toast makes. "zero
 * database modifications" is a claim about the server, so the component must not
 * make it unconditionally.
 */
describe("DryRunToggle", () => {
  it("starts switched off with no controls shown", () => {
    setup();

    expect(toggle()).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByRole("button", { name: /run validation/i })).toBeNull();
  });

  it("reveals the run control when switched on", async () => {
    setup();

    clickToggle();

    expect(toggle()).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("button", { name: /run validation/i }),
    ).toBeEnabled();
  });

  it("switches back off", async () => {
    setup();

    clickToggle();
    clickToggle();

    expect(toggle()).toHaveAttribute("aria-checked", "false");
  });

  it("sends the file to the validation-only endpoint", async () => {
    const validateFile = vi.fn().mockResolvedValue(report());
    setup({ validateFile });

    clickToggle();
    clickRun();

    await waitFor(() => expect(validateFile).toHaveBeenCalledTimes(1));
    expect(validateFile.mock.calls[0][0]).toBeInstanceOf(File);
  });

  it("shows the full validation report", async () => {
    setup({
      validateFile: vi.fn().mockResolvedValue(
        report({ imported: 40, skipped: 3 }),
      ),
    });

    clickToggle();
    clickRun();

    expect(await screen.findByText("Validation passed")).toBeInTheDocument();
    expect(screen.getByText("Would import")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("Would skip")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("confirms a clean run with the exact message the issue specifies", async () => {
    setup();

    clickToggle();
    clickRun();

    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith(DRY_RUN_SUCCESS_MESSAGE, "success"),
    );
  });

  it("lists validation errors and does not claim success", async () => {
    setup({
      validateFile: vi.fn().mockResolvedValue(
        report({
          errors: [
            { row: 4, field: "end_time", message: "must be after start_time" },
            { row: 9, message: "unknown service_id" },
          ],
        }),
      ),
    });

    clickToggle();
    clickRun();

    expect(
      await screen.findByText("Validation found problems"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Row 4: end_time — must be after start_time/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Row 9: unknown service_id/)).toBeInTheDocument();

    await waitFor(() =>
      expect(toastMessages().join(" ")).toMatch(/2 validation errors/),
    );
    expect(toastMessages()).not.toContain(DRY_RUN_SUCCESS_MESSAGE);
    expect(toastSpy).toHaveBeenCalledWith(expect.any(String), "error");
  });

  it("treats a reported database modification as a failure", async () => {
    setup({
      validateFile: vi
        .fn()
        .mockResolvedValue(report({ database_modified: true })),
    });

    clickToggle();
    clickRun();

    // Claiming zero modifications when the server says otherwise would be worse
    // than saying nothing at all.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /reported database modifications/i,
    );
    expect(toastMessages()).not.toContain(DRY_RUN_SUCCESS_MESSAGE);
  });

  it("states the server confirmation when it is given", async () => {
    setup({
      validateFile: vi
        .fn()
        .mockResolvedValue(report({ database_modified: false })),
    });

    clickToggle();
    clickRun();

    expect(
      await screen.findByText(/server confirmed no database rows were modified/i),
    ).toBeInTheDocument();
  });

  it("softens the wording when the server does not report one", async () => {
    setup();

    clickToggle();
    clickRun();

    expect(
      await screen.findByText(/did not report a modification count/i),
    ).toBeInTheDocument();
  });

  it("surfaces a request failure", async () => {
    setup({
      validateFile: vi.fn().mockRejectedValue(new Error("502 Bad Gateway")),
    });

    clickToggle();
    clickRun();

    expect(await screen.findByRole("alert")).toHaveTextContent("502 Bad Gateway");
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith("502 Bad Gateway", "error"),
    );
  });

  it("passes the report to the parent", async () => {
    const onReport = vi.fn();
    setup({ onReport });

    clickToggle();
    clickRun();

    await waitFor(() => expect(onReport).toHaveBeenCalledTimes(1));
    expect(onReport.mock.calls[0][0]).toMatchObject({ imported: 12 });
  });

  it("cannot be run without a file", async () => {
    const validateFile = vi.fn();
    render(<DryRunToggle file={null} validateFile={validateFile} />);

    clickToggle();

    expect(screen.getByRole("button", { name: /run validation/i })).toBeDisabled();
    expect(screen.getByText(/select a file to validate/i)).toBeInTheDocument();
    expect(validateFile).not.toHaveBeenCalled();
  });
});
