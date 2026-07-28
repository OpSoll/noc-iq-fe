import { describe, it, expect } from "vitest";
import { getDomainConfig, domainConfigs } from "./queryConfig";

describe("getDomainConfig", () => {
  it("returns config for known domains", () => {
    expect(getDomainConfig("outages").staleTime).toBe(30_000);
    expect(getDomainConfig("payments").refetchInterval).toBe(120_000);
  });
  it("returns default for unknown domain", () => {
    expect(getDomainConfig("unknown").staleTime).toBe(30_000);
  });
});

describe("domainConfigs", () => {
  it("has all expected domains", () => {
    expect(Object.keys(domainConfigs)).toContain("outages");
    expect(Object.keys(domainConfigs)).toContain("payments");
    expect(Object.keys(domainConfigs)).toContain("analytics");
  });
});
