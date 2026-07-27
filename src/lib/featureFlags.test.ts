import { describe, it, expect, beforeEach } from "vitest";
import { isFeatureEnabled, getKnownFlags, setFeatureFlag } from "@/lib/featureFlags";

describe("featureFlags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    if (typeof window !== "undefined") {
      window.__FEATURE_FLAGS = undefined;
    }
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("NEXT_PUBLIC_FLAG_")) {
        delete process.env[key];
      }
    }
  });

  describe("isFeatureEnabled", () => {
    it("returns false for unknown flags", () => {
      expect(isFeatureEnabled("nonexistent_flag_xyz")).toBe(false);
    });

    it("returns default value for known flags", () => {
      expect(isFeatureEnabled("admin_error_budget")).toBe(false);
      expect(isFeatureEnabled("compare_mode")).toBe(true);
    });

    it("reads from NEXT_PUBLIC_FLAG_ env vars", () => {
      process.env.NEXT_PUBLIC_FLAG_ADMIN_ERROR_BUDGET = "true";
      expect(isFeatureEnabled("admin_error_budget")).toBe(true);

      process.env.NEXT_PUBLIC_FLAG_ADMIN_ERROR_BUDGET = "1";
      expect(isFeatureEnabled("admin_error_budget")).toBe(true);

      process.env.NEXT_PUBLIC_FLAG_ADMIN_ERROR_BUDGET = "false";
      expect(isFeatureEnabled("admin_error_budget")).toBe(false);
    });

    it("env var '1' enables a flag", () => {
      process.env.NEXT_PUBLIC_FLAG_OTEL_TRACING = "1";
      expect(isFeatureEnabled("otel_tracing")).toBe(true);
    });

    it("runtime override takes precedence over env var", () => {
      process.env.NEXT_PUBLIC_FLAG_ADMIN_ERROR_BUDGET = "false";
      setFeatureFlag("admin_error_budget", true);
      expect(isFeatureEnabled("admin_error_budget")).toBe(true);
    });

    it("env var takes precedence over default", () => {
      process.env.NEXT_PUBLIC_FLAG_COMPARE_MODE = "false";
      expect(isFeatureEnabled("compare_mode")).toBe(false);
    });
  });

  describe("getKnownFlags", () => {
    it("returns all known flags with current state", () => {
      const flags = getKnownFlags();
      expect(flags).toHaveProperty("admin_error_budget");
      expect(flags).toHaveProperty("otel_tracing");
      expect(flags).toHaveProperty("compare_mode");
      expect(flags.admin_error_budget).toHaveProperty("description");
      expect(typeof flags.admin_error_budget.enabled).toBe("boolean");
    });

    it("reflects env var changes", () => {
      process.env.NEXT_PUBLIC_FLAG_OTEL_TRACING = "true";
      const flags = getKnownFlags();
      expect(flags.otel_tracing.enabled).toBe(true);
    });
  });

  describe("setFeatureFlag", () => {
    it("sets runtime override", () => {
      setFeatureFlag("admin_error_budget", true);
      expect(isFeatureEnabled("admin_error_budget")).toBe(true);
    });

    it("can override to false", () => {
      process.env.NEXT_PUBLIC_FLAG_COMPARE_MODE = "true";
      setFeatureFlag("compare_mode", false);
      expect(isFeatureEnabled("compare_mode")).toBe(false);
    });
  });
});
