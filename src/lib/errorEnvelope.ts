export type ApiErrorEnvelope = {
  error: string;
  message: string;
  status: number;
  correlationId?: string;
  details?: Record<string, unknown>;
  domain?: string;
};

export type ParsedError = {
  userMessage: string;
  domain: string;
  recoverable: boolean;
};

const domainFallbacks: Record<string, string> = {
  auth: "Authentication error. Please try signing in again.",
  validation: "Some fields are invalid. Please check your input.",
  not_found: "The requested resource was not found.",
  rate_limit: "Too many requests. Please wait and try again.",
  server: "A server error occurred. Our team has been notified.",
  network: "Network error. Please check your connection.",
};

export function parseErrorEnvelope(envelope: ApiErrorEnvelope): ParsedError {
  const domain = envelope.domain || "unknown";
  return {
    userMessage: envelope.message || domainFallbacks[domain] || domainFallbacks.server,
    domain,
    recoverable: !["server", "auth"].includes(domain),
  };
}

export function createErrorEnvelope(status: number, error: string, message: string, correlationId?: string): ApiErrorEnvelope {
  let domain = "unknown";
  if (status >= 400 && status < 500) domain = status === 404 ? "not_found" : status === 429 ? "rate_limit" : "validation";
  if (status >= 500) domain = "server";
  if (status === 0) domain = "network";
  return { error, message, status, correlationId, domain };
}
