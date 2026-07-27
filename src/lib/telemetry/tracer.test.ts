import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getTracer,
  getCompletedSpans,
  clearSpans,
  resetTracer,
  generateCorrelationId,
  setCorrelationId,
  getCorrelationId,
  instrumentLoad,
  instrumentMutate,
} from "@/lib/telemetry/tracer";

describe("tracer", () => {
  beforeEach(() => {
    resetTracer();
  });

  describe("correlation ID", () => {
    it("generates a unique correlation ID", () => {
      const id1 = generateCorrelationId();
      const id2 = generateCorrelationId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^span-/);
    });

    it("stores and retrieves correlation ID", () => {
      expect(getCorrelationId()).toBeNull();
      setCorrelationId("test-id-123");
      expect(getCorrelationId()).toBe("test-id-123");
    });
  });

  describe("noop tracer (when OTEL disabled)", () => {
    it("returns a no-op tracer by default", () => {
      const tracer = getTracer();
      const span = tracer.startSpan("test");
      // Should not throw
      span.setAttribute("key", "value");
      span.addEvent("event");
      span.setStatus("ok");
      span.end();
      // No spans stored when using noop tracer
      expect(getCompletedSpans()).toHaveLength(0);
    });
  });

  describe("instrumentLoad", () => {
    it("creates a span and records success", async () => {
      clearSpans();
      const result = await instrumentLoad("dashboard", async () => {
        return "data";
      });
      expect(result).toBe("data");
    });

    it("creates a span and records error", async () => {
      clearSpans();
      await expect(
        instrumentLoad("dashboard", async () => {
          throw new Error("fail");
        })
      ).rejects.toThrow("fail");
    });
  });

  describe("instrumentMutate", () => {
    it("creates a span and records success", async () => {
      clearSpans();
      const result = await instrumentMutate("outages", async () => {
        return { id: 1 };
      });
      expect(result).toEqual({ id: 1 });
    });

    it("creates a span and records error", async () => {
      clearSpans();
      await expect(
        instrumentMutate("outages", async () => {
          throw new Error("mutation failed");
        })
      ).rejects.toThrow("mutation failed");
    });
  });

  describe("clearSpans", () => {
    it("clears the span store", () => {
      clearSpans();
      expect(getCompletedSpans()).toHaveLength(0);
    });
  });
});
