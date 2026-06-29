export type DestinationSafetyWarning = {
  type: "duplicate_url" | "unreachable" | "self_cert" | "rate_limited" | "no_tls";
  message: string;
  severity: "warning" | "error";
};

export type SafetyCheckResult = {
  url: string;
  safe: boolean;
  warnings: DestinationSafetyWarning[];
};

export function checkDestinationSafety(url: string, existingUrls: string[]): SafetyCheckResult {
  const warnings: DestinationSafetyWarning[] = [];

  if (existingUrls.includes(url)) {
    warnings.push({ type: "duplicate_url", message: "This URL is already registered as a webhook destination", severity: "warning" });
  }

  if (!url.startsWith("https://")) {
    warnings.push({ type: "no_tls", message: "URL does not use HTTPS. Webhook data will be sent in plaintext.", severity: "error" });
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      warnings.push({ type: "self_cert", message: "Destination points to localhost. Webhooks will not reach external services.", severity: "warning" });
    }
  } catch {
    warnings.push({ type: "unreachable", message: "URL is malformed and cannot be reached.", severity: "error" });
  }

  return { url, safe: warnings.filter((w) => w.severity === "error").length === 0, warnings };
}

export function getSafetySummary(results: SafetyCheckResult[]): { total: number; safe: number; warnings: number; errors: number } {
  const safe = results.filter((r) => r.safe).length;
  const errors = results.filter((r) => r.warnings.some((w) => w.severity === "error")).length;
  const warnings = results.filter((r) => r.warnings.some((w) => w.severity === "warning")).length;
  return { total: results.length, safe, warnings, errors };
}
