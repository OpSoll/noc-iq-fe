import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  observeLongTasks,
  observeINP,
  getPerformanceMetrics,
  clearPerformanceMetrics,
  disconnectObservers,
  isMonitoredRoute,
  initPerformanceMonitoring,
  onLongTask,
  resetOnLongTaskCallback,
} from "@/lib/telemetry/performance";

describe("performance telemetry", () => {
  beforeEach(() => {
    clearPerformanceMetrics();
    disconnectObservers();
    resetOnLongTaskCallback();
  });

  afterEach(() => {
    disconnectObservers();
    resetOnLongTaskCallback();
  });

  describe("isMonitoredRoute", () => {
    it("returns true for monitored routes", () => {
      expect(isMonitoredRoute("/dashboard")).toBe(true);
      expect(isMonitoredRoute("/outages")).toBe(true);
      expect(isMonitoredRoute("/payments")).toBe(true);
      expect(isMonitoredRoute("/webhooks")).toBe(true);
    });

    it("returns false for unmonitored routes", () => {
      expect(isMonitoredRoute("/settings")).toBe(false);
      expect(isMonitoredRoute("/admin")).toBe(false);
    });
  });

  describe("metrics store", () => {
    it("starts with empty metrics", () => {
      const m = getPerformanceMetrics();
      expect(m.longTasks).toHaveLength(0);
      expect(m.inp).toHaveLength(0);
    });

    it("clears metrics", () => {
      clearPerformanceMetrics();
      const m = getPerformanceMetrics();
      expect(m.longTasks).toHaveLength(0);
    });
  });

  describe("observeLongTasks", () => {
    it("does not throw when PerformanceObserver is unavailable", () => {
      const original = globalThis.PerformanceObserver;
      // @ts-expect-error testing without observer
      delete globalThis.PerformanceObserver;
      expect(() => observeLongTasks()).not.toThrow();
      globalThis.PerformanceObserver = original;
    });
  });

  describe("observeINP", () => {
    it("does not throw when PerformanceObserver is unavailable", () => {
      const original = globalThis.PerformanceObserver;
      // @ts-expect-error testing without observer
      delete globalThis.PerformanceObserver;
      expect(() => observeINP()).not.toThrow();
      globalThis.PerformanceObserver = original;
    });
  });

  describe("initPerformanceMonitoring", () => {
    it("initializes for monitored routes", () => {
      expect(() => initPerformanceMonitoring("/dashboard")).not.toThrow();
    });

    it("skips unmonitored routes", () => {
      initPerformanceMonitoring("/settings");
      const m = getPerformanceMetrics();
      expect(m.longTasks).toHaveLength(0);
    });
  });

  describe("onLongTask callback", () => {
    it("registers and resets callback", () => {
      const fn = vi.fn();
      onLongTask(fn);
      resetOnLongTaskCallback();
    });
  });
});
