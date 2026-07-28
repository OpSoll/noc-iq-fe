// Closes #199: frontend observability hook for route errors and key actions
// Closes #200: lightweight API shape drift check (pending full OpenAPI codegen)

const REDACT_KEYS = new Set(["token", "access_token", "refresh_token", "wallet_secret", "password"]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) =>
        REDACT_KEYS.has(k) ? [k, "[redacted]"] : [k, redact(v)],
      ),
    );
  }
  return value;
}

export interface TelemetryEvent {
  type: "route_error" | "user_action";
  name: string;
  detail?: unknown;
}

export function trackEvent(event: TelemetryEvent): void {
  const safeDetail = event.detail !== undefined ? redact(event.detail) : undefined;
  // eslint-disable-next-line no-console
  console.info("[telemetry]", event.type, event.name, safeDetail);
}

export type ShapeSpec = Record<string, "string" | "number" | "boolean" | "object">;

// Reports which expected keys are missing or type-mismatched on a live API response.
export function checkShapeDrift(sample: Record<string, unknown>, spec: ShapeSpec): string[] {
  const drift: string[] = [];
  for (const [key, expectedType] of Object.entries(spec)) {
    if (!(key in sample)) {
      drift.push(`missing field: ${key}`);
      continue;
    }
    if (typeof sample[key] !== expectedType) {
      drift.push(`type mismatch for ${key}: expected ${expectedType}, got ${typeof sample[key]}`);
    }
  }
  return drift;
}
