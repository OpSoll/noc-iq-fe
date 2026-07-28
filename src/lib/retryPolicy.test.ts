import { describe, it, expect } from "vitest";
import { getRetryConfig, classifyError } from "./retryPolicy";

describe("getRetryConfig", () => {
  it("returns correct config for timeout", () => {
    expect(getRetryConfig("timeout").maxRetries).toBe(3);
  });
  it("returns no retries for auth", () => {
    expect(getRetryConfig("auth").maxRetries).toBe(0);
  });
});

describe("classifyError", () => {
  it("classifies 401 as auth", () => { expect(classifyError(401)).toBe("auth"); });
  it("classifies 500 as serverError", () => { expect(classifyError(500)).toBe("serverError"); });
  it("classifies 422 as validation", () => { expect(classifyError(422)).toBe("validation"); });
  it("classifies no status as network", () => { expect(classifyError()).toBe("network"); });
  it("classifies timeout code", () => { expect(classifyError(undefined, "ECONNABORTED")).toBe("timeout"); });
});
