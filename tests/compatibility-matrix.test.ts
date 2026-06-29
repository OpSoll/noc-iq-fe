import { describe, it, expect } from "vitest";
import { detectContractDrift, buildDriftReport } from "./contractDrift";
import { normalizeOutage, normalizePayment } from "./normalizers";

describe("Client Contract Compatibility Matrix", () => {
  it("detects no drift when shapes match", () => {
    const expected = { id: "string", site_name: "string", severity: "string" };
    const actual = { id: "001", site_name: "Site A", severity: "critical" };
    expect(detectContractDrift(expected, actual)).toEqual([]);
  });

  it("detects type drift", () => {
    const expected = { id: "string", amount: "string" };
    const actual = { id: "001", amount: 500 };
    const warnings = detectContractDrift(expected, actual);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].field).toBe("amount");
  });

  it("generates drift report with severity counts", () => {
    const report = buildDriftReport("/api/v1/outages", { id: "string", amount: "string" }, { id: "001", amount: 500 });
    expect(report.criticalCount).toBe(1);
    expect(report.warnings).toHaveLength(1);
  });

  it("normalizes outage to expected shape", () => {
    const normalized = normalizeOutage({ id: "123", site_name: "Site A", severity: "high", status: "open", detected_at: "2026-06-01T00:00:00Z" });
    expect(normalized.siteName).toBe("Site A");
    expect(normalized.severity).toBe("high");
  });

  it("normalizes payment with snake_case mapping", () => {
    const normalized = normalizePayment({ id: "p1", transaction_hash: "0xabc", amount: 500, asset_code: "USDC", status: "confirmed", created_at: "2026-06-01T00:00:00Z" });
    expect(normalized.transactionHash).toBe("0xabc");
    expect(normalized.assetCode).toBe("USDC");
  });

  it("handles null resolved_at in outage", () => {
    const normalized = normalizeOutage({ id: "123", site_name: "Site A", severity: "medium", status: "open", detected_at: "2026-06-01T00:00:00Z" });
    expect(normalized.resolvedAt).toBeNull();
  });
});
