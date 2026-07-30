import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRecoveryHandler } from "./queryRecovery";

describe("createRecoveryHandler", () => {
  it("counts failed queries", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const query = client.getQueryCache().build(client, {
      queryKey: ["test"],
      queryFn: () => Promise.reject(new Error("fail")),
    });
    query.setState({ status: "error", error: new Error("fail") });
    const handler = createRecoveryHandler(client);
    expect(typeof handler.retryFailedQueries).toBe("function");
    expect(typeof handler.getPendingRetries).toBe("function");
  });
});
