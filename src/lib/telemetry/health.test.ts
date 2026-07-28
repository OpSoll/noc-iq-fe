import { describe, it, expect, beforeEach } from "vitest";
import { TelemetryHealthManager } from "@/lib/telemetry/health";

describe("TelemetryHealthManager", () => {
  let manager: TelemetryHealthManager;

  beforeEach(() => {
    manager = new TelemetryHealthManager();
  });

  it("starts in normal state", () => {
    expect(manager.getState()).toBe("normal");
  });

  it("stays normal with low drop rate", () => {
    for (let i = 0; i < 100; i++) {
      manager.recordEmit();
    }
    manager.recordDrop();
    expect(manager.getState()).toBe("normal");
  });

  it("transitions to degraded with high drop rate", () => {
    for (let i = 0; i < 100; i++) {
      if (i % 10 === 0) {
        manager.recordDrop();
      } else {
        manager.recordEmit();
      }
    }
    expect(manager.getState()).toBe("degraded");
  });

  it("returns disabled state when disabled", () => {
    manager.disable();
    expect(manager.getState()).toBe("disabled");
  });

  it("resumes normal after enable", () => {
    manager.disable();
    manager.enable();
    expect(manager.getState()).toBe("normal");
  });

  it("counts drops correctly", () => {
    manager.recordDrop();
    manager.recordDrop();
    manager.recordEmit();
    const metrics = manager.getMetrics();
    expect(metrics.totalDropped).toBe(2);
    expect(metrics.totalEmitted).toBe(1);
    expect(metrics.dropRate).toBeCloseTo(2 / 3);
  });

  it("reports uptime", () => {
    const metrics = manager.getMetrics();
    expect(metrics.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it("resets all state", () => {
    manager.recordDrop();
    manager.recordDrop();
    manager.recordDrop();
    manager.reset();
    const metrics = manager.getMetrics();
    expect(metrics.totalDropped).toBe(0);
    expect(metrics.totalEmitted).toBe(0);
    expect(manager.getState()).toBe("normal");
  });

  it("does not record when disabled", () => {
    manager.disable();
    manager.recordEmit();
    manager.recordDrop();
    const metrics = manager.getMetrics();
    expect(metrics.totalEmitted).toBe(0);
    expect(metrics.totalDropped).toBe(0);
  });
});
