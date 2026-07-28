import { vi, describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useMutationToast } from "@/hooks/useMutationToast";

const mockToast = vi.fn();

vi.mock("@/components/ui/toast", () => ({
  useToast: () => mockToast,
}));

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useMutationToast", () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    mockToast.mockClear();
  });

  it("shows success toast on successful mutation", async () => {
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => "done",
          successMessage: "Operation completed",
        }),
      { wrapper: makeWrapper(client) },
    );

    await act(async () => {
      result.current.mutate();
    });

    expect(mockToast).toHaveBeenCalledWith("Operation completed", "success");
  });

  it("shows error toast on failed mutation", async () => {
    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => {
            throw new Error("Something broke");
          },
          errorMessage: "Custom error message",
        }),
      { wrapper: makeWrapper(client) },
    );

    await act(async () => {
      result.current.mutate(undefined as never);
    });

    expect(mockToast).toHaveBeenCalledWith("Custom error message", "error");
  });

  it("calls user-provided onSuccess callback", async () => {
    const userOnSuccess = vi.fn();

    const { result } = renderHook(
      () =>
        useMutationToast({
          mutationFn: async () => "result",
          successMessage: "Done",
          onSuccess: userOnSuccess,
        }),
      { wrapper: makeWrapper(client) },
    );

    await act(async () => {
      result.current.mutate();
    });

    expect(userOnSuccess).toHaveBeenCalledWith("result", undefined, undefined, expect.anything());
  });
});
