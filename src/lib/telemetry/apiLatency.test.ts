import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyEndpoint,
  recordLatency,
  getEntries,
  clearEntries,
  computePercentiles,
  findOutliers,
  tagEnvironment,
  resetLatencyStore,
} from "@/lib/telemetry/apiLatency";

describe("apiLatency", () => {
  beforeEach(() => {
    resetLatencyStore();
  });

  describe("classifyEndpoint", () => {
    it("classifies outages", () => {
      expect(classifyEndpoint("/outages")).toBe("outages");
      expect(classifyEndpoint("/outages/123")).toBe("outages");
    });

    it("classifies payments", () => {
      expect(classifyEndpoint("/payments")).toBe("payments");
      expect(classifyEndpoint("/payments/456/retry")).toBe("payments");
    });

    it("classifies sla", () => {
      expect(classifyEndpoint("/sla/config")).toBe("sla");
    });

    it("classifies webhooks", () => {
      expect(classifyEndpoint("/webhooks")).toBe("webhooks");
      expect(classifyEndpoint("/webhooks/1/deliveries")).toBe("webhooks");
    });

    it("returns null for unknown endpoints", () => {
      expect(classifyEndpoint("/unknown")).toBeNull();
      expect(classifyEndpoint("/dashboard")).toBeNull();
    });
  });

  describe("recordLatency", () => {
    it("stores entries for known groups", () => {
      recordLatency(100, "/outages", "corr-1");
      recordLatency(200, "/payments");
      const e = getEntries();
      expect(e).toHaveLength(2);
      expect(e[0].group).toBe("outages");
      expect(e[0].correlationId).toBe("corr-1");
    });

    it("ignores unknown groups", () => {
      recordLatency(100, "/unknown");
      expect(getEntries()).toHaveLength(0);
    });
  });

  describe("computePercentiles", () => {
    it("returns 0 for empty data", () => {
      const p = computePercentiles("outages");
      expect(p.p50).toBe(0);
      expect(p.p90).toBe(0);
      expect(p.p99).toBe(0);
      expect(p.count).toBe(0);
    });

    it("computes correct percentiles", () => {
      for (let i = 1; i <= 100; i++) {
        recordLatency(i, "/outages");
      }
      const p = computePercentiles("outages");
      expect(p.count).toBe(100);
      expect(p.p50).toBe(50);
      expect(p.p90).toBe(90);
      expect(p.p99).toBe(99);
    });
  });

  describe("findOutliers", () => {
    it("returns empty for insufficient data", () => {
      for (let i = 1; i <= 5; i++) {
        recordLatency(i, "/payments");
      }
      expect(findOutliers("payments")).toHaveLength(0);
    });

    it("finds p99 outliers", () => {
      for (let i = 1; i <= 100; i++) {
        recordLatency(i, "/payments");
      }
      const outliers = findOutliers("payments");
      expect(outliers.length).toBeGreaterThan(0);
      expect(outliers[0].correlationId).toBeUndefined();
    });
  });

  describe("tagEnvironment", () => {
    it("returns environment tag", () => {
      const tag = tagEnvironment("outages", "/outages", "mutation");
      expect(tag.route).toBe("/outages");
      expect(tag.requestClass).toBe("mutation");
      expect(typeof tag.env).toBe("string");
    });
  });

  describe("clearEntries", () => {
    it("clears all entries", () => {
      recordLatency(100, "/outages");
      clearEntries();
      expect(getEntries()).toHaveLength(0);
    });
  });
});
