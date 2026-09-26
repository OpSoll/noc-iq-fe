/**
 * System health service
 *
 * Closes #611 – Dashboard: system status indicator (health pill)
 *
 * Reads the backend readiness probe through the canonical `api` axios instance
 * so the request inherits the base URL, bearer token, correlation ID and
 * offline detection used by every other service in the app.
 *
 * The frontend has no other readiness consumer, so this module also owns the
 * contract: the endpoint returns a list of dependency checks and this service
 * rolls them up into a single status. Anything it does not recognise degrades
 * to `unknown` rather than being reported as healthy.
 */
import type { AxiosError as IAxiosError } from 'axios';

import { api } from '@/lib/api';

/** Readiness state of the platform or of one of its dependencies. */
export type DependencyStatus = 'operational' | 'degraded' | 'down' | 'unknown';

export interface DependencyHealth {
  /** Human readable dependency name, e.g. `postgres`. */
  name: string;
  status: DependencyStatus;
  /** Probe latency in milliseconds, when the backend reports it. */
  latency_ms?: number;
  /** Optional detail, e.g. the failing reason. */
  message?: string;
}

export interface SystemHealthReport {
  /** One entry per dependency the readiness probe covers. */
  checks: DependencyHealth[];
  /** Round-trip latency of the readiness probe itself. */
  latency_ms?: number;
}

const SYSTEM_HEALTH_ENDPOINT = '/health';

interface ApiErrorResponse {
  message?: string;
}

function handleApiError(error: unknown, fallbackMessage: string): never {
  if ((error as IAxiosError).isAxiosError) {
    const axErr = error as IAxiosError<ApiErrorResponse>;
    const apiError = axErr.response?.data;

    throw new Error(apiError?.message || axErr.message || fallbackMessage);
  }

  if (error instanceof Error) {
    throw new Error(error.message);
  }

  throw new Error(fallbackMessage);
}

function isDependencyStatus(value: unknown): value is DependencyStatus {
  return (
    value === 'operational' || value === 'degraded' || value === 'down'
  );
}

/**
 * Coerce an untrusted status string. Unknown values become `unknown` so a
 * backend response the UI does not understand is never painted as healthy.
 */
function coerceStatus(value: unknown): DependencyStatus {
  return isDependencyStatus(value) ? value : 'unknown';
}

/**
 * Roll dependency checks up into one status: the worst check wins, and an empty
 * check list is `unknown` because there is nothing to vouch for the platform.
 */
export function summarizeSystemHealth(
  checks: DependencyHealth[] | undefined
): DependencyStatus {
  if (!checks || checks.length === 0) return 'unknown';

  const statuses = checks.map((check) => coerceStatus(check.status));

  if (statuses.includes('down')) return 'down';
  if (statuses.includes('degraded')) return 'degraded';
  if (statuses.includes('unknown')) return 'unknown';
  return 'operational';
}

/**
 * Fetch the current readiness report.
 */
export async function getSystemHealth(options?: {
  signal?: AbortSignal;
}): Promise<SystemHealthReport> {
  const startedAt = Date.now();

  try {
    const res = await api.get<SystemHealthReport>(SYSTEM_HEALTH_ENDPOINT, {
      signal: options?.signal,
    });

    return {
      checks: Array.isArray(res.data?.checks) ? res.data.checks : [],
      latency_ms: res.data?.latency_ms ?? Date.now() - startedAt,
    };
  } catch (error) {
    handleApiError(error, 'Failed to fetch system health.');
  }
}
