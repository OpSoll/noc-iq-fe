import { act, renderHook } from "@testing-library/react";
import { describe, it, beforeEach, expect, vi } from "vitest";

const mockRouterPush = vi.fn();
const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
    toString: () => {
      const keys = ["page", "page_size", "severity", "status", "search", "sort_field", "sort_order"];
      const parts: string[] = [];
      for (const k of keys) {
        const v = mockSearchParamsGet(k);
        if (v) parts.push(`${k}=${encodeURIComponent(v)}`);
      }
      return parts.join("&");
    },
  }),
}));

// Import after mocks are set up
import { useOutagesTableState } from "@/hooks/useOutagesTableState";

describe("useOutagesTableState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null); // default: no params
  });

  describe("initial state", () => {
    it("returns default pagination values when no URL params exist", () => {
      const { result } = renderHook(() => useOutagesTableState());

      expect(result.current.state.page).toBe(1);
      expect(result.current.state.page_size).toBe(10);
      expect(result.current.state.severity).toBeUndefined();
      expect(result.current.state.status).toBeUndefined();
      expect(result.current.state.search).toBeUndefined();
      expect(result.current.state.sort_field).toBeUndefined();
      expect(result.current.state.sort_order).toBe("desc");
    });

    it("reads page and page_size from URL params", () => {
      mockSearchParamsGet.mockImplementation((key: string) => {
        const params: Record<string, string> = {
          page: "3",
          page_size: "25",
        };
        return params[key] ?? null;
      });

      const { result } = renderHook(() => useOutagesTableState());

      expect(result.current.state.page).toBe(3);
      expect(result.current.state.page_size).toBe(25);
    });
  });

  describe("pagination", () => {
    it("setPage pushes new page param to router", () => {
      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setPage(5);
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?page=5");
    });

    it("setPage clamps to minimum of 1", () => {
      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setPage(0);
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?page=1");
    });

    it("setPageSize resets page to 1", () => {
      mockSearchParamsGet.mockImplementation((key: string) => {
        const params: Record<string, string> = { page: "4" };
        return params[key] ?? null;
      });

      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setPageSize(50);
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?page=1&page_size=50");
    });
  });

  describe("filter application", () => {
    it("setSeverity adds severity param and resets page to 1", () => {
      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setSeverity("critical");
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?severity=critical&page=1");
    });

    it("setSeverity removes severity param when undefined", () => {
      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setSeverity(undefined);
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?page=1");
    });

    it("setStatus adds status param and resets page to 1", () => {
      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setStatus("open");
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?status=open&page=1");
    });

    it("setStatus removes status param when undefined", () => {
      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setStatus(undefined);
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?page=1");
    });

    it("setSearch adds search param and resets page to 1", () => {
      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setSearch("Lagos");
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?search=Lagos&page=1");
    });

    it("setSearch removes search param when empty string", () => {
      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setSearch("");
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?page=1");
    });
  });

  describe("sort direction change", () => {
    it("setSort adds sort_field and sort_order params and resets page", () => {
      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setSort("severity", "asc");
      });

      expect(mockRouterPush).toHaveBeenCalledWith(
        "?sort_field=severity&sort_order=asc&page=1",
      );
    });

    it("setSort overwrites existing sort params in URL", () => {
      mockSearchParamsGet.mockImplementation((key: string) => {
        const params: Record<string, string> = {
          sort_field: "detected_at",
          sort_order: "desc",
        };
        return params[key] ?? null;
      });

      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.setSort("status", "asc");
      });

      expect(mockRouterPush).toHaveBeenCalledWith(
        "?sort_field=status&sort_order=asc&page=1",
      );
    });

    it("clearSort removes sort params", () => {
      mockSearchParamsGet.mockImplementation((key: string) => {
        const params: Record<string, string> = {
          sort_field: "severity",
          sort_order: "desc",
        };
        return params[key] ?? null;
      });

      const { result } = renderHook(() => useOutagesTableState());

      act(() => {
        result.current.actions.clearSort();
      });

      expect(mockRouterPush).toHaveBeenCalledWith("?page=1");
    });
  });

  describe("read sort values from URL", () => {
    it("parses valid sort_field and sort_order from URL params", () => {
      mockSearchParamsGet.mockImplementation((key: string) => {
        const params: Record<string, string> = {
          sort_field: "detected_at",
          sort_order: "asc",
        };
        return params[key] ?? null;
      });

      const { result } = renderHook(() => useOutagesTableState());

      expect(result.current.state.sort_field).toBe("detected_at");
      expect(result.current.state.sort_order).toBe("asc");
    });

    it("defaults sort_order to desc when invalid value provided", () => {
      mockSearchParamsGet.mockImplementation((key: string) => {
        const params: Record<string, string> = {
          sort_order: "invalid",
        };
        return params[key] ?? null;
      });

      const { result } = renderHook(() => useOutagesTableState());

      expect(result.current.state.sort_order).toBe("desc");
    });

    it("ignores invalid sort_field values", () => {
      mockSearchParamsGet.mockImplementation((key: string) => {
        const params: Record<string, string> = {
          sort_field: "invalid_field",
        };
        return params[key] ?? null;
      });

      const { result } = renderHook(() => useOutagesTableState());

      expect(result.current.state.sort_field).toBeUndefined();
    });
  });
});
