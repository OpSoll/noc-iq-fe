import { describe, it, expect } from "vitest";
import {
  bucketForMttrMinutes,
  buildMttrHistogram,
  outageMttrMinutes,
} from "./mttrHistogram";
import type { Outage } from "@/types/outages";

function makeOutage(overrides: Partial<Outage>): Outage {
  return {
    id: overrides.id ?? "o1",
    site_name: "Site A",
    severity: overrides.severity ?? "high",
    status: overrides.status ?? "resolved",
    detected_at: overrides.detected_at ?? "2026-01-01T00:00:00Z",
    resolved_at: overrides.resolved_at,
    description: "test",
    affected_services: [],
    sla_status: overrides.sla_status,
    ...overrides,
  };
}

describe("bucketForMttrMinutes", () => {
  it("buckets sub-15-minute durations", () => {
    expect(bucketForMttrMinutes(0)).toBe("lt15");
    expect(bucketForMttrMinutes(14.9)).toBe("lt15");
  });

  it("buckets 15-30 minute durations", () => {
    expect(bucketForMttrMinutes(15)).toBe("15to30");
    expect(bucketForMttrMinutes(29.9)).toBe("15to30");
  });

  it("buckets 30-60 minute durations", () => {
    expect(bucketForMttrMinutes(30)).toBe("30to60");
    expect(bucketForMttrMinutes(59.9)).toBe("30to60");
  });

  it("buckets 60+ minute durations", () => {
    expect(bucketForMttrMinutes(60)).toBe("gt60");
    expect(bucketForMttrMinutes(500)).toBe("gt60");
  });
});

describe("outageMttrMinutes", () => {
  it("prefers the recorded sla_status.mttr_minutes", () => {
    const outage = makeOutage({
      detected_at: "2026-01-01T00:00:00Z",
      resolved_at: "2026-01-01T02:00:00Z",
      sla_status: {
        status: "met",
        mttr_minutes: 42,
        threshold_minutes: 60,
        amount: 10,
        payment_type: "reward",
        rating: "good",
      },
    });
    expect(outageMttrMinutes(outage)).toBe(42);
  });

  it("falls back to computing from detected/resolved timestamps", () => {
    const outage = makeOutage({
      detected_at: "2026-01-01T00:00:00Z",
      resolved_at: "2026-01-01T00:20:00Z",
    });
    expect(outageMttrMinutes(outage)).toBe(20);
  });

  it("returns null when there is no resolution data", () => {
    const outage = makeOutage({ status: "open", resolved_at: undefined });
    expect(outageMttrMinutes(outage)).toBeNull();
  });
});

describe("buildMttrHistogram", () => {
  const outages: Outage[] = [
    makeOutage({ id: "1", severity: "critical", detected_at: "2026-01-01T00:00:00Z", resolved_at: "2026-01-01T00:10:00Z" }), // 10m -> lt15
    makeOutage({ id: "2", severity: "high", detected_at: "2026-01-02T00:00:00Z", resolved_at: "2026-01-02T00:20:00Z" }), // 20m -> 15to30
    makeOutage({ id: "3", severity: "medium", detected_at: "2026-01-03T00:00:00Z", resolved_at: "2026-01-03T00:45:00Z" }), // 45m -> 30to60
    makeOutage({ id: "4", severity: "low", detected_at: "2026-01-04T00:00:00Z", resolved_at: "2026-01-04T02:00:00Z" }), // 120m -> gt60
    makeOutage({ id: "5", severity: "critical", status: "open", resolved_at: undefined }), // excluded: still open
  ];

  it("groups resolved outages into the four MTTR buckets", () => {
    const histogram = buildMttrHistogram(outages);
    expect(histogram.map((b) => [b.key, b.count])).toEqual([
      ["lt15", 1],
      ["15to30", 1],
      ["30to60", 1],
      ["gt60", 1],
    ]);
  });

  it("excludes open outages", () => {
    const histogram = buildMttrHistogram(outages);
    const total = histogram.reduce((sum, b) => sum + b.count, 0);
    expect(total).toBe(4);
  });

  it("filters by severity tier", () => {
    const histogram = buildMttrHistogram(outages, { severity: "critical" });
    expect(histogram.find((b) => b.key === "lt15")?.count).toBe(1);
    expect(histogram.reduce((sum, b) => sum + b.count, 0)).toBe(1);
  });

  it("filters by resolved-date range", () => {
    const histogram = buildMttrHistogram(outages, {
      dateFrom: "2026-01-02",
      dateTo: "2026-01-03",
    });
    expect(histogram.reduce((sum, b) => sum + b.count, 0)).toBe(2);
    expect(histogram.find((b) => b.key === "15to30")?.count).toBe(1);
    expect(histogram.find((b) => b.key === "30to60")?.count).toBe(1);
  });

  it("recalculates independently when filters change", () => {
    const unfiltered = buildMttrHistogram(outages);
    const filtered = buildMttrHistogram(outages, { severity: "low" });
    expect(unfiltered.reduce((sum, b) => sum + b.count, 0)).toBe(4);
    expect(filtered.reduce((sum, b) => sum + b.count, 0)).toBe(1);
  });
});
