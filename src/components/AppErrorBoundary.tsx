'use client';

/**
 * AppErrorBoundary
 *
 * Global React Error Boundary that catches uncaught render exceptions and
 * replaces the white-screen crash with a friendly recovery card.
 *
 * Features:
 *   - "Try Again" button resets the boundary and re-renders the child tree.
 *   - "Reload App" button performs a clean browser reload.
 *   - Component stack trace is logged to client telemetry on every catch.
 *   - Accepts an optional `fallback` prop for per-section overrides.
 *   - Accepts an optional `section` prop for contextual error messages.
 *
 * Closes #712 – UI Resilience: Add global React Error Boundary with fallback recovery UI
 */

import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';

// ─── Telemetry logging ────────────────────────────────────────────────────────

/**
 * Logs the caught error and React component stack to the client telemetry
 * channel. In production this is the `console.error` stream (captured by
 * error-monitoring services such as Sentry via their SDK instrumentation).
 * The function is extracted so it can be spied on in tests.
 */
export function logErrorToTelemetry(error: Error, errorInfo: ErrorInfo): void {
  console.error(
    '[AppErrorBoundary] Caught render error:',
    error.message,
    '\nComponent stack:',
    errorInfo.componentStack ?? '(unavailable)',
    '\nStack trace:',
    error.stack ?? '(unavailable)'
  );
}

// ─── Boundary state ───────────────────────────────────────────────────────────

interface BoundaryProps {
  children: ReactNode;
  /** Contextual section name shown in the fallback message ("in Outages Table"). */
  section?: string;
  /** Fully custom fallback node; when provided the built-in card is not rendered. */
  fallback?: ReactNode;
  /** Called after the boundary catches an error. Useful for tests and monitoring. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface BoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ─── Fallback card ────────────────────────────────────────────────────────────

function ErrorFallbackCard({
  error,
  section,
  onReset,
}: {
  error: Error | null;
  section?: string;
  onReset: () => void;
}) {
  function handleReload() {
    window.location.reload();
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-[40vh] items-center justify-center px-4 py-12"
    >
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-8 shadow-sm text-center">
        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-7 w-7 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Heading */}
        <h2 className="text-lg font-semibold text-red-900">
          Something went wrong
          {section ? ` in ${section}` : ''}
        </h2>

        {/* Description */}
        <p className="mt-2 text-sm text-red-700">
          An unexpected error occurred. You can try again or reload the app to
          start fresh.
        </p>

        {/* Error details (collapsed) — only in dev / when message is available */}
        {process.env.NODE_ENV !== 'production' && error?.message && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs font-medium text-red-600 hover:underline">
              Error details
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-red-100 p-3 text-xs text-red-800 whitespace-pre-wrap break-all">
              {error.message}
            </pre>
          </details>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-medium text-red-700 shadow-sm transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={handleReload}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            Reload App
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AppErrorBoundary ─────────────────────────────────────────────────────────

/**
 * AppErrorBoundary
 *
 * Mount once at app root (or per route section) to prevent uncaught render
 * exceptions from causing a white-screen crash.
 *
 * @example
 * ```tsx
 * // Root mount in src/app/layout.tsx
 * <AppErrorBoundary>
 *   {children}
 * </AppErrorBoundary>
 *
 * // Per-section mount
 * <AppErrorBoundary section="Outages Table">
 *   <OutagesTable data={outages} />
 * </AppErrorBoundary>
 * ```
 */
export class AppErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to client telemetry (captured by error-monitoring SDKs).
    logErrorToTelemetry(error, errorInfo);
    // Notify optional external handler (e.g. for tests or Sentry.captureException).
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, fallback, section } = this.props;

    if (!hasError) {
      return children;
    }

    // Caller-supplied custom fallback takes full precedence.
    if (fallback != null) {
      return fallback;
    }

    return (
      <ErrorFallbackCard
        error={error}
        section={section}
        onReset={this.handleReset}
      />
    );
  }
}

// ─── useDarkMode hook (preserved from original file) ─────────────────────────

const DARK_MODE_KEY = 'noc_dark_mode';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = localStorage.getItem(DARK_MODE_KEY);
    if (stored) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  const toggle = () => {
    setIsDark((prev) => {
      localStorage.setItem(DARK_MODE_KEY, String(!prev));
      return !prev;
    });
  };

  return { isDark, toggle };
}
