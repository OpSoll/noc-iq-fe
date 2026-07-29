import { describe, it, expect } from "vitest";
import { queryKeys } from "./queryKeys";

describe("queryKeys", () => {
  it("generates consistent keys", () => {
    expect(queryKeys.outages.all).toEqual(["outages"]);
    expect(queryKeys.outages.list({ severity: "high" })).toEqual(["outages", "list", { severity: "high" }]);
    expect(queryKeys.outages.detail("123")).toEqual(["outages", "detail", "123"]);
  });
  it("different params produce different keys", () => {
    const a = queryKeys.payments.list({ page: 1 });
    const b = queryKeys.payments.list({ page: 2 });
    expect(a).not.toEqual(b);
  });
  it("dashboard keys use hierarchical structure", () => {
    expect(queryKeys.dashboard.all).toEqual(["dashboard"]);
    expect(queryKeys.dashboard.metrics({ severity: "high" })).toEqual([
      "dashboard",
      "metrics",
      { severity: "high" },
    ]);
    expect(queryKeys.dashboard.compare({ date_from: "2025-01-01" })).toEqual([
      "dashboard",
      "compare",
      { date_from: "2025-01-01" },
    ]);
  });
  it("dashboard metrics and compare produce different keys", () => {
    const m = queryKeys.dashboard.metrics({ severity: "high" });
    const c = queryKeys.dashboard.compare({ severity: "high" });
    expect(m).not.toEqual(c);
  });
  it("wallet keys are consistent", () => {
    expect(queryKeys.wallet.all).toEqual(["wallet"]);
    expect(queryKeys.wallet.detail("u1")).toEqual(["wallet", "detail", "u1"]);
    expect(queryKeys.wallet.status("u1")).toEqual(["wallet", "status", "u1"]);
    expect(queryKeys.wallet.balance("addr")).toEqual(["wallet", "balance", "addr"]);
  });
});
