import { describe, it, expect, vi } from "vitest";
import { createCoalescer } from "./requestCoalesce";

describe("requestCoalesce", () => {
  it("deduplicates identical requests", async () => {
    const coalescer = createCoalescer();
    const fetcher = vi.fn().mockResolvedValue("data");
    const [a, b] = await Promise.all([
      coalescer.request("key1", fetcher),
      coalescer.request("key1", fetcher),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a).toBe("data");
    expect(b).toBe("data");
  });

  it("isolates by auth scope", async () => {
    const coalescer = createCoalescer();
    const f1 = vi.fn().mockResolvedValue("a");
    const f2 = vi.fn().mockResolvedValue("b");
    await Promise.all([
      coalescer.request("key", f1, { authScope: "user1" }),
      coalescer.request("key", f2, { authScope: "user2" }),
    ]);
    expect(f1).toHaveBeenCalledTimes(1);
    expect(f2).toHaveBeenCalledTimes(1);
  });
});
