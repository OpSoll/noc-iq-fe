import { describe, expect, it } from "vitest";

import {
  buildDashboardShareUrl,
  buildDashboardSnapshot,
} from "@/lib/dashboardSnapshot";

describe("dashboard snapshot utilities", () => {
  it("builds a share url that preserves dashboard filter context", () => {
    const url = buildDashboardShareUrl(
      "https://noc.example.com",
      "/",
      {
        date_from: "2026-07-01",
        date_to: "2026-07-28",
        severity: "critical",
        site: "site-a",
      },
      true,
    );

    expect(url).toBe(
      "https://noc.example.com/?date_from=2026-07-01&date_to=2026-07-28&severity=critical&site=site-a&compare=1",
    );
  });

  it("marks empty exports so snapshot workflows can handle no-data states gracefully", () => {
    const snapshot = buildDashboardSnapshot(
      {
        sla_compliance_percentage: 0,
        penalties: { total: 0, count: 0 },
        rewards: { total: 0, count: 0 },
        trends: [],
      },
      {
        date_from: "2026-07-01",
        date_to: "2026-07-28",
      },
      "dashboard",
      "https://noc.example.com/",
    );

    expect(snapshot.schema_version).toBe("dashboard.snapshot.v1");
    expect(snapshot.is_empty).toBe(true);
    expect(snapshot.filters).toEqual({
      date_from: "2026-07-01",
      date_to: "2026-07-28",
    });
    expect(snapshot.share_url).toBe("https://noc.example.com/");
  });
});

