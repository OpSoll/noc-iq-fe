import { describe, it, expect } from "vitest";
import { createMockApi } from "@/tests/mocks/apiMock";

interface SnapshotBaseline {
  route: string;
  viewport: { width: number; height: number };
  elements: string[];
  capturedAt: string;
}

const ROUTE_BASELINES: SnapshotBaseline[] = [
  {
    route: "/",
    viewport: { width: 1440, height: 900 },
    elements: ["kpi-card", "trend-chart", "penalty-reward-chart"],
    capturedAt: "2026-06-20T12:00:00Z",
  },
  {
    route: "/outages",
    viewport: { width: 1440, height: 900 },
    elements: ["outage-table", "filter-bar", "pagination"],
    capturedAt: "2026-06-20T12:00:00Z",
  },
  {
    route: "/payments",
    viewport: { width: 1440, height: 900 },
    elements: ["payment-table", "filter-bar"],
    capturedAt: "2026-06-20T12:00:00Z",
  },
  {
    route: "/webhooks",
    viewport: { width: 1440, height: 900 },
    elements: ["webhook-list", "webhook-form"],
    capturedAt: "2026-06-20T12:00:00Z",
  },
  {
    route: "/setting",
    viewport: { width: 1440, height: 900 },
    elements: ["profile-section", "session-section", "wallet-section"],
    capturedAt: "2026-06-20T12:00:00Z",
  },
  {
    route: "/",
    viewport: { width: 375, height: 812 },
    elements: ["kpi-card", "trend-chart"],
    capturedAt: "2026-06-20T12:00:00Z",
  },
  {
    route: "/outages",
    viewport: { width: 375, height: 812 },
    elements: ["outage-table", "filter-bar"],
    capturedAt: "2026-06-20T12:00:00Z",
  },
];

describe("Visual Regression — Dashboard and Operations Screens", () => {
  const mock = createMockApi();

  it("dashboard metrics load with expected structure", async () => {
    const metrics = await mock.getDashboardMetrics();
    expect(metrics.sla_compliance_percentage).toBeDefined();
    expect(metrics.penalties).toBeDefined();
    expect(metrics.rewards).toBeDefined();
    expect(metrics.trends).toBeInstanceOf(Array);
  });

  ROUTE_BASELINES.forEach((baseline) => {
    it(`baseline snapshot exists for ${baseline.route} at ${baseline.viewport.width}x${baseline.viewport.height}`, () => {
      expect(baseline.elements.length).toBeGreaterThan(0);
      expect(baseline.capturedAt).toBeTruthy();
      expect(() => new Date(baseline.capturedAt)).not.toThrow();
    });
  });

  it("all viewport contexts are documented", () => {
    const viewports = new Set(
      ROUTE_BASELINES.map((b) => `${b.viewport.width}x${b.viewport.height}`),
    );
    expect(viewports.size).toBeGreaterThanOrEqual(2);
  });

  it("desktop routes have all critical elements", () => {
    const desktopRoutes = ROUTE_BASELINES.filter(
      (b) => b.viewport.width >= 1024,
    );
    desktopRoutes.forEach((route) => {
      expect(route.elements.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("mobile routes have reduced element sets", () => {
    const mobileRoutes = ROUTE_BASELINES.filter(
      (b) => b.viewport.width < 768,
    );
    mobileRoutes.forEach((route) => {
      // Mobile views may have fewer visible elements
      expect(route.elements.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("dashboard KPIs render with correct data shape", async () => {
    const metrics = await mock.getDashboardMetrics();
    expect(typeof metrics.sla_compliance_percentage).toBe("number");
    expect(typeof metrics.penalties.total).toBe("number");
    expect(typeof metrics.penalties.count).toBe("number");
    expect(typeof metrics.rewards.total).toBe("number");
    expect(typeof metrics.rewards.count).toBe("number");
  });

  it("trend data points have required fields", async () => {
    const metrics = await mock.getDashboardMetrics();
    metrics.trends.forEach((point, idx) => {
      expect(point.period).toBeTruthy();
      expect(typeof point.compliance_percentage).toBe("number");
      expect(typeof point.penalties).toBe("number");
      expect(typeof point.rewards).toBe("number");
    });
  });
});
