export type ErrorClass = "timeout" | "serverError" | "auth" | "validation" | "network";

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  backoffMultiplier: number;
}

const policies: Record<ErrorClass, RetryConfig> = {
  timeout: { maxRetries: 3, baseDelayMs: 1000, backoffMultiplier: 2 },
  serverError: { maxRetries: 3, baseDelayMs: 2000, backoffMultiplier: 2 },
  auth: { maxRetries: 0, baseDelayMs: 0, backoffMultiplier: 1 },
  validation: { maxRetries: 0, baseDelayMs: 0, backoffMultiplier: 1 },
  network: { maxRetries: 2, baseDelayMs: 1000, backoffMultiplier: 2 },
};

export function getRetryConfig(errorClass: ErrorClass): RetryConfig {
  return policies[errorClass] ?? policies.network;
}

export function classifyError(status?: number, code?: string): ErrorClass {
  if (!status && code === "ECONNABORTED") return "timeout";
  if (!status) return "network";
  if (status === 401 || status === 403) return "auth";
  if (status === 422) return "validation";
  if (status >= 500) return "serverError";
  return "network";
}
