import { describe, it, expect, beforeEach } from "vitest";
import { saveDraft, loadDraft, clearDraft } from "@/lib/drafts";

const KEY = "test-draft";
const VALUES = { name: "test", desc: "hello" };

beforeEach(() => {
  sessionStorage.clear();
});

describe("saveDraft / loadDraft", () => {
  it("stores and retrieves a draft", () => {
    saveDraft(KEY, VALUES);
    const draft = loadDraft(KEY);
    expect(draft).not.toBeNull();
    expect(draft!.values).toEqual(VALUES);
    expect(draft!.savedAt).toBeGreaterThan(0);
    expect(draft!.expiresAt).toBeGreaterThan(draft!.savedAt);
  });

  it("returns null for unknown key", () => {
    expect(loadDraft("no-such")).toBeNull();
  });

  it("clears a draft", () => {
    saveDraft(KEY, VALUES);
    clearDraft(KEY);
    expect(loadDraft(KEY)).toBeNull();
  });

  it("returns null after expiration", () => {
    saveDraft(KEY, VALUES, -1);
    expect(loadDraft(KEY)).toBeNull();
  });
});
