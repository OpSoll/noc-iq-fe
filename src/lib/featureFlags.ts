/**
 * src/lib/featureFlags.ts
 *
 * Environment-aware feature-flag system backed by NEXT_PUBLIC_ env vars.
 * Flags are evaluated once at module load time and can be overridden at runtime
 * via window.__FEATURE_FLAGS (useful for QA/debugging).
 */

export type FeatureFlag = string;

const FLAG_PREFIX = "NEXT_PUBLIC_FLAG_";

// ── Known flags ─────────────────────────────────────────────────────────────

const KNOWN_FLAGS: Record<string, { default: boolean; description: string }> = {
  admin_error_budget: {
    default: false,
    description: "Enable the error-budget dashboard at /admin/error-budget",
  },
  otel_tracing: {
    default: false,
    description: "Enable route-level OpenTelemetry span instrumentation",
  },
  compare_mode: {
    default: true,
    description: "Enable SLA dashboard compare mode",
  },
};

// ── Runtime overrides ────────────────────────────────────────────────────────

declare global {
  interface Window {
    __FEATURE_FLAGS?: Record<string, boolean>;
  }
}

function readEnvFlag(key: string): boolean | undefined {
  const envKey = `${FLAG_PREFIX}${key.toUpperCase()}`;
  const val = process.env[envKey];
  if (val === undefined) return undefined;
  return val === "true" || val === "1";
}

function readRuntimeOverride(key: string): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  return window.__FEATURE_FLAGS?.[key];
}

// ── Public API ───────────────────────────────────────────────────────────────

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const runtime = readRuntimeOverride(flag);
  if (runtime !== undefined) return runtime;

  const env = readEnvFlag(flag);
  if (env !== undefined) return env;

  if (KNOWN_FLAGS[flag]) return KNOWN_FLAGS[flag].default;

  return false;
}

export function getKnownFlags(): Record<string, { enabled: boolean; description: string }> {
  const result: Record<string, { enabled: boolean; description: string }> = {};
  for (const [key, meta] of Object.entries(KNOWN_FLAGS)) {
    result[key] = { enabled: isFeatureEnabled(key), description: meta.description };
  }
  return result;
}

export function setFeatureFlag(flag: FeatureFlag, enabled: boolean): void {
  if (typeof window !== "undefined") {
    if (!window.__FEATURE_FLAGS) window.__FEATURE_FLAGS = {};
    window.__FEATURE_FLAGS[flag] = enabled;
  }
}
