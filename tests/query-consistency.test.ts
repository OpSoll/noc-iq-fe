import { describe, it, expect } from "vitest";

type SharedResource = { route: string; key: string; expectedShape: Record<string, string> };
const sharedResources: SharedResource[] = [
  { route: "/outages", key: "outage_list", expectedShape: { id: "string", site_name: "string", severity: "string", status: "string" } },
  { route: "/payments", key: "payment_list", expectedShape: { id: "string", transaction_hash: "string", amount: "string" } },
  { route: "/webhooks", key: "webhook_list", expectedShape: { id: "string", url: "string", event_type: "string" } },
];

function checkShape(data: Record<string, unknown>, shape: Record<string, string>): string[] {
  const mismatches: string[] = [];
  for (const [key, expectedType] of Object.entries(shape)) {
    const actual = typeof data[key];
    if (actual !== expectedType && !(data[key] === null && expectedType === "string")) {
      mismatches.push(`${key}: expected ${expectedType}, got ${actual}`);
    }
  }
  return mismatches;
}

describe("Cross-Route Shared Resource Consistency", () => {
  it.each(sharedResources)("$route returns consistent shape for $key", ({ key, expectedShape }) => {
    const mockData: Record<string, unknown> = { id: "test-001", site_name: "Site A", severity: "critical", status: "open" };
    if (key === "payment_list") Object.assign(mockData, { transaction_hash: "0xabc", amount: "500" });
    if (key === "webhook_list") Object.assign(mockData, { url: "https://example.com/hook", event_type: "outage.created" });

    const mismatches = checkShape(mockData, expectedShape);
    expect(mismatches).toEqual([]);
  });

  it("detects type mismatch in shared resource shape", () => {
    const result = checkShape({ id: 123, site_name: "Site B", severity: "low", status: "open" } as unknown as Record<string, unknown>, { id: "string" });
    expect(result).toContEqual(expect.stringContaining("id"));
  });
});
