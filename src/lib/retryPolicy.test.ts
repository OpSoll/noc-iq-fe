import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getRetryConfig,
  classifyError,
  isRetryableMethod,
  backoffDelay,
  fetchWithTimeoutAndRetry,
  RetryPolicyError,
  REQUEST_TIMEOUT_MS,
  MAX_GET_RETRIES,
  RETRY_BASE_DELAY_MS,
} from "./retryPolicy";

// ─── Existing policy table tests (unchanged) ──────────────────────────────────

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

// ─── isRetryableMethod ────────────────────────────────────────────────────────

describe("isRetryableMethod", () => {
  it("returns true for GET", () => expect(isRetryableMethod("GET")).toBe(true));
  it("returns true for get (lowercase)", () => expect(isRetryableMethod("get")).toBe(true));
  it("returns false for POST", () => expect(isRetryableMethod("POST")).toBe(false));
  it("returns false for PUT", () => expect(isRetryableMethod("PUT")).toBe(false));
  it("returns false for PATCH", () => expect(isRetryableMethod("PATCH")).toBe(false));
  it("returns false for DELETE", () => expect(isRetryableMethod("DELETE")).toBe(false));
});

// ─── backoffDelay ─────────────────────────────────────────────────────────────

describe("backoffDelay", () => {
  it("returns baseMs for attempt 1", () => {
    expect(backoffDelay(1, 1000)).toBe(1000);
  });
  it("doubles on attempt 2", () => {
    expect(backoffDelay(2, 1000)).toBe(2000);
  });
  it("quadruples on attempt 3", () => {
    expect(backoffDelay(3, 1000)).toBe(4000);
  });
  it("uses RETRY_BASE_DELAY_MS as default", () => {
    expect(backoffDelay(1)).toBe(RETRY_BASE_DELAY_MS);
  });
});

// ─── fetchWithTimeoutAndRetry ─────────────────────────────────────────────────

describe("fetchWithTimeoutAndRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns response on first success", async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(mockResponse);

    const promise = fetchWithTimeoutAndRetry("/api/test");
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("throws RetryPolicyError on GET timeout (AbortError)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );

    const promise = fetchWithTimeoutAndRetry("/api/test", {
      timeoutMs: 100,
      maxRetries: 0,
    });
    const result = promise.catch((error) => error as RetryPolicyError);
    await vi.runAllTimersAsync();

    const err = await result;
    expect(err.timedOut).toBe(true);
  });

  it("retries GET up to MAX_GET_RETRIES times on network failure", async () => {
    const networkError = new Error("network error");
    const successResponse = new Response("{}", { status: 200 });

    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce(successResponse);

    const promise = fetchWithTimeoutAndRetry("/api/test", {
      maxRetries: MAX_GET_RETRIES,
    });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.status).toBe(200);
    // 2 failures + 1 success = 3 total calls
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("does not retry POST requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("network error"),
    );

    const promise = fetchWithTimeoutAndRetry("/api/resource", {
      fetchInit: { method: "POST" },
    });
    const result = promise.catch((error) => error as RetryPolicyError);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBeInstanceOf(RetryPolicyError);
    // Only 1 attempt — no retry for mutating methods
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("does not retry PUT requests", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("network error"),
    );

    const promise = fetchWithTimeoutAndRetry("/api/resource", {
      fetchInit: { method: "PUT" },
    });
    const result = promise.catch((error) => error as RetryPolicyError);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBeInstanceOf(RetryPolicyError);
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it("throws RetryPolicyError with correct attempts count after all retries exhausted", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fail"));

    const promise = fetchWithTimeoutAndRetry("/api/test", { maxRetries: 2 });
    const result = promise.catch((error) => error as RetryPolicyError);
    await vi.runAllTimersAsync();

    const err = await result;
    expect(err).toBeInstanceOf(RetryPolicyError);
    expect(err.attempts).toBe(3); // 1 initial + 2 retries
  });

  it("uses REQUEST_TIMEOUT_MS as default timeout", () => {
    expect(REQUEST_TIMEOUT_MS).toBe(10_000);
  });
});
