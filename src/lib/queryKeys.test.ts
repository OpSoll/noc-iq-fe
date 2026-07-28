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
});
