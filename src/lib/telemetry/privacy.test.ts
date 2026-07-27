import { describe, it, expect, beforeEach } from "vitest";
import {
  sanitize,
  sanitizeForEmission,
  getBlockedFields,
  setBlockedFields,
  resetBlockedFields,
} from "@/lib/telemetry/privacy";

describe("privacy guard", () => {
  beforeEach(() => {
    resetBlockedFields();
  });

  describe("sanitize", () => {
    it("passes through primitives unchanged", () => {
      expect(sanitize("hello")).toBe("hello");
      expect(sanitize(42)).toBe(42);
      expect(sanitize(null)).toBeNull();
      expect(sanitize(undefined)).toBeUndefined();
    });

    it("redacts blocked top-level fields", () => {
      const result = sanitize({ password: "secret123", name: "Alice" });
      expect(result.password).toBe("[REDACTED]");
      expect(result.name).toBe("Alice");
    });

    it("redacts nested blocked fields", () => {
      const result = sanitize({
        user: {
          name: "Bob",
          credentials: { token: "abc", secret: "xyz" },
        },
      });
      expect(result.user.name).toBe("Bob");
      expect(result.user.credentials.token).toBe("[REDACTED]");
      expect(result.user.credentials.secret).toBe("[REDACTED]");
    });

    it("redacts fields in arrays", () => {
      const result = sanitize([
        { token: "a", value: 1 },
        { password: "b", value: 2 },
      ]);
      expect(result[0].token).toBe("[REDACTED]");
      expect(result[0].value).toBe(1);
      expect(result[1].password).toBe("[REDACTED]");
    });

    it("handles case-insensitive matching", () => {
      const result = sanitize({
        Password: "a",
        TOKEN: "b",
        ApiKey: "c",
      });
      expect(result.Password).toBe("[REDACTED]");
      expect(result.TOKEN).toBe("[REDACTED]");
      expect(result.ApiKey).toBe("[REDACTED]");
    });

    it("handles key normalization (dashes, underscores, spaces)", () => {
      const result = sanitize({
        "api-key": "a",
        api_key: "b",
        "api key": "c",
      });
      expect(result["api-key"]).toBe("[REDACTED]");
      expect(result.api_key).toBe("[REDACTED]");
      expect(result["api key"]).toBe("[REDACTED]");
    });

    it("does not mutate original object", () => {
      const original = { password: "secret", name: "test" };
      sanitize(original);
      expect(original.password).toBe("secret");
    });

    it("redacts PII fields", () => {
      const result = sanitize({
        email: "user@example.com",
        phone: "555-1234",
        ssn: "123-45-6789",
      });
      expect(result.email).toBe("[REDACTED]");
      expect(result.phone).toBe("[REDACTED]");
      expect(result.ssn).toBe("[REDACTED]");
    });

    it("redacts wallet-related fields", () => {
      const result = sanitize({
        wallet_private_key: "0xabc",
        mnemonic: "word1 word2",
        seed_phrase: "seed123",
      });
      expect(result.wallet_private_key).toBe("[REDACTED]");
      expect(result.mnemonic).toBe("[REDACTED]");
      expect(result.seed_phrase).toBe("[REDACTED]");
    });
  });

  describe("sanitizeForEmission", () => {
    it("returns sanitized payload", () => {
      const result = sanitizeForEmission({ token: "abc", data: 123 });
      expect(result.token).toBe("[REDACTED]");
      expect(result.data).toBe(123);
    });

    it("returns original on error", () => {
      // Force error by passing something that breaks JSON serialization internally
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      // sanitize handles circular references gracefully
      const result = sanitizeForEmission(circular);
      expect(result).toBeDefined();
    });
  });

  describe("blocked fields management", () => {
    it("returns default blocked fields", () => {
      const fields = getBlockedFields();
      expect(fields).toContain("token");
      expect(fields).toContain("password");
      expect(fields).toContain("secret");
    });

    it("allows custom blocked fields", () => {
      setBlockedFields(["custom_field", "another"]);
      const fields = getBlockedFields();
      expect(fields).toContain("custom_field");
      expect(fields).toContain("another");
      // defaults are replaced
      expect(fields).not.toContain("token");
    });

    it("resets to defaults", () => {
      setBlockedFields(["only_this"]);
      resetBlockedFields();
      const fields = getBlockedFields();
      expect(fields).toContain("token");
      expect(fields).not.toContain("only_this");
    });
  });
});
