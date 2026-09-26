import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadDraft, useAutoSaveDraft } from "@/lib/drafts";

describe("useAutoSaveDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves dirty form values every five seconds", () => {
    const { rerender } = renderHook(
      ({ values, dirty }) => useAutoSaveDraft("outage-new", values, dirty),
      { initialProps: { values: { description: "Initial" }, dirty: true } },
    );

    vi.advanceTimersByTime(4_999);
    expect(loadDraft("outage-new")).toBeNull();

    rerender({ values: { description: "Updated" }, dirty: true });
    vi.advanceTimersByTime(1);

    expect(loadDraft("outage-new")?.values).toEqual({ description: "Updated" });
  });
});