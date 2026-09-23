/**
 * Unit tests for useMutationToast (closes #697)
 *
 * Covers:
 *  - Green success toast with static and dynamic message
 *  - Success toast action link appended to the message
 *  - Red error toast with parsed API error message
 *  - Retry hint injected into error toast by default
 *  - Retry hint suppressed when showRetry=false
 *  - Caller-supplied onSuccess / onError callbacks still fire
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Toast mock ────────────────────────────────────────────────────────────────
// We stub the toast infrastructure so we can inspect calls without a DOM tree.
const mockToast = vi.fn<[string, string], void>();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => mockToast,
}));

// ── API normalizer mock ───────────────────────────────────────────────────────
vi.mock("@/lib/api", () => ({
  normalizeApiError: (err: unknown) => {
    const e = err as { response?: { data?: { detail?: string }; status?: number } };
    const detail = e?.response?.data?.detail;
    return {
      message: detail ?? "Unexpected API error",
      kind: "unknown",
      status: e?.response?.status,
    };
  },
}));

import { useMutationToast } from "./useMutationToast";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false } },
    logger: { log: () => {}, warn: () => {}, error: () => {} },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useMutationToast", () => {
  beforeEach(() => {
    mockToast.mockClear();
  });

  // ── Success path ─────────────────────────────────────────────────────────

  it("triggers green success toast with static message on mutation success", async () => {
    const client = freshClient();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => ({ id: "123" }),
          successMessage: "Outage resolved",
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockToast).toHaveBeenCalledWith("Outage resolved", "success");
  });

  it("accepts a factory function for the success message", async () => {
    const client = freshClient();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async (name: string) => ({ name }),
          successMessage: (data) => `Created: ${data.name}`,
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate("Outage-42"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockToast).toHaveBeenCalledWith("Created: Outage-42", "success");
  });

  it("appends action link label to success toast message when successAction is provided", async () => {
    const client = freshClient();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => ({ id: "abc" }),
          successMessage: "Record saved",
          successAction: { label: "View record", href: "/outages/abc" },
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [msg, variant] = mockToast.mock.calls[0];
    expect(variant).toBe("success");
    expect(msg).toContain("View record");
    expect(msg).toContain("/outages/abc");
  });

  it("resolves successAction from a factory when data is available", async () => {
    const client = freshClient();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => ({ id: "xyz" }),
          successMessage: "Done",
          successAction: (data) => ({ label: "Open", href: `/outages/${data.id}` }),
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [msg] = mockToast.mock.calls[0];
    expect(msg).toContain("/outages/xyz");
  });

  it("still calls caller-supplied onSuccess callback", async () => {
    const client = freshClient();
    const spy = vi.fn();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => "ok",
          onSuccess: spy,
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(spy).toHaveBeenCalledOnce();
  });

  // ── Error path ───────────────────────────────────────────────────────────

  it("triggers red error toast with parsed API error message on failure", async () => {
    const client = freshClient();
    const apiErr = {
      response: { status: 422, data: { detail: "Site ID already exists" } },
    };

    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => {
            throw apiErr;
          },
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isError).toBe(true));

    const [msg, variant] = mockToast.mock.calls[0];
    expect(variant).toBe("error");
    expect(msg).toContain("Site ID already exists");
  });

  it("includes retry hint in error toast by default", async () => {
    const client = freshClient();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => {
            throw new Error("Network down");
          },
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isError).toBe(true));

    const [msg] = mockToast.mock.calls[0];
    expect(msg.toLowerCase()).toContain("retry");
  });

  it("suppresses retry hint when showRetry=false", async () => {
    const client = freshClient();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => {
            throw new Error("Not allowed");
          },
          showRetry: false,
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isError).toBe(true));

    const [msg] = mockToast.mock.calls[0];
    expect(msg.toLowerCase()).not.toContain("retry");
  });

  it("uses static errorMessage when provided instead of parsed API error", async () => {
    const client = freshClient();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => {
            throw new Error("raw error");
          },
          errorMessage: "Custom error message",
          showRetry: false,
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith("Custom error message", "error");
  });

  it("uses factory errorMessage when provided", async () => {
    const client = freshClient();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => {
            throw new Error("detail from server");
          },
          errorMessage: (err) =>
            `Wrapped: ${err instanceof Error ? err.message : "unknown"}`,
          showRetry: false,
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockToast).toHaveBeenCalledWith("Wrapped: detail from server", "error");
  });

  it("still calls caller-supplied onError callback", async () => {
    const client = freshClient();
    const spy = vi.fn();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => {
            throw new Error("boom");
          },
          onError: spy,
          showRetry: false,
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(spy).toHaveBeenCalledOnce();
  });

  // ── Default message fallback ─────────────────────────────────────────────

  it("falls back to default success message when none is provided", async () => {
    const client = freshClient();
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => null,
        }),
      { wrapper: makeWrapper(client) },
    );

    act(() => result.current.mutate(undefined));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [msg] = mockToast.mock.calls[0];
    expect(msg).toBe("Action completed successfully");
  });
});
