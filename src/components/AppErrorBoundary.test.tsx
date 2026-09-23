import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppErrorBoundary, logErrorToTelemetry } from "./AppErrorBoundary";
import type { ErrorInfo } from "react";

// ─── Test helpers ──────────────────────────────────────────────────────────────

/** Component that always throws during render. */
function ThrowingChild({ message = "Test render error" }: { message?: string }) {
  throw new Error(message);
}

/** Component that renders normally. */
function SafeChild({ text = "Content OK" }: { text?: string }) {
  return <div>{text}</div>;
}

// Suppress expected React error boundary console output during tests
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── logErrorToTelemetry ───────────────────────────────────────────────────────

describe("logErrorToTelemetry", () => {
  it("calls console.error with the error message and component stack", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("test error");
    const info: ErrorInfo = { componentStack: "\n  at ThrowingChild\n  at AppErrorBoundary" };

    logErrorToTelemetry(err, info);

    expect(consoleSpy).toHaveBeenCalledOnce();
    const callArgs = consoleSpy.mock.calls[0];
    // The first argument should mention the error message
    expect(String(callArgs[1])).toContain("test error");
  });
});

// ─── AppErrorBoundary rendering ───────────────────────────────────────────────

describe("AppErrorBoundary", () => {
  it("renders children normally when no error is thrown", () => {
    render(
      <AppErrorBoundary>
        <SafeChild text="All good" />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("renders fallback card when child throws", () => {
    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it("renders 'Try Again' button in fallback", () => {
    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders 'Reload App' button in fallback", () => {
    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("button", { name: /reload app/i })).toBeInTheDocument();
  });

  it("includes section name in fallback heading when section prop is provided", () => {
    render(
      <AppErrorBoundary section="Outages Table">
        <ThrowingChild />
      </AppErrorBoundary>,
    );
    expect(screen.getByText(/Something went wrong in Outages Table/i)).toBeInTheDocument();
  });

  it("renders custom fallback node when fallback prop is provided", () => {
    render(
      <AppErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild />
      </AppErrorBoundary>,
    );
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls onError with the caught error and errorInfo", () => {
    const onError = vi.fn();
    render(
      <AppErrorBoundary onError={onError}>
        <ThrowingChild message="boundary test" />
      </AppErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledOnce();
    const [capturedError] = onError.mock.calls[0];
    expect(capturedError.message).toBe("boundary test");
  });

  it("logs the error to telemetry via console.error on catch", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <AppErrorBoundary>
        <ThrowingChild message="telemetry test" />
      </AppErrorBoundary>,
    );
    // console.error should have been called (by logErrorToTelemetry)
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("resets the boundary and re-renders children when 'Try Again' is clicked", () => {
    let shouldThrow = true;

    function ConditionalChild() {
      if (shouldThrow) throw new Error("conditional throw");
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <AppErrorBoundary>
        <ConditionalChild />
      </AppErrorBoundary>,
    );

    // Boundary should show fallback
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Stop throwing, then click Try Again
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    rerender(
      <AppErrorBoundary>
        <ConditionalChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByText("Recovered")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
