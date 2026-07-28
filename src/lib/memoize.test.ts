import { describe, it, expect } from "vitest";
import { createBoundedMemoize, memoizeTransform } from "./memoize";

describe("createBoundedMemoize", () => {
  it("stores and retrieves values", () => {
    const m = createBoundedMemoize<string, number>(10, (k) => k);
    m.set("a", 1);
    expect(m.get("a")).toBe(1);
  });
  it("evicts oldest at bounds", () => {
    const m = createBoundedMemoize<string, number>(2, (k) => k);
    m.set("a", 1); m.set("b", 2); m.set("c", 3);
    expect(m.get("a")).toBeUndefined();
    expect(m.size).toBe(2);
  });
});

describe("memoizeTransform", () => {
  it("caches results", () => {
    let calls = 0;
    const fn = memoizeTransform((x: number) => { calls++; return x * 2; }, (x) => String(x));
    expect(fn(5)).toBe(10);
    expect(fn(5)).toBe(10);
    expect(calls).toBe(1);
  });
});
