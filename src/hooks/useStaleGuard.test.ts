import { act, renderHook } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { useStaleGuard } from '@/hooks/useStaleGuard';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Mock the API module so we can control GET responses in tests.
// ---------------------------------------------------------------------------
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(api.get);

/* -------------------------------------------------------------------------- */
/*  Test helpers                                                               */
/* -------------------------------------------------------------------------- */

const FORM_UPDATED_AT = '2026-09-25T10:00:00Z';
const SERVER_SAME = '2026-09-25T10:00:00Z';
const SERVER_NEWER = '2026-09-25T10:05:00Z';
const SERVER_OLDER = '2026-09-25T09:55:00Z';

const defaultOpts = () => ({
  endpoint: '/outages/abc-123',
  formUpdatedAt: FORM_UPDATED_AT,
});

/* -------------------------------------------------------------------------- */
/*  Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('useStaleGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── initial state ──────────────────────────────────────────────────────
  describe('initial state', () => {
    it('starts with no conflict, no error, and not checking', () => {
      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      expect(result.current.conflict).toBeNull();
      expect(result.current.isChecking).toBe(false);
      expect(result.current.checkError).toBeNull();
    });
  });

  // ─── guardedSubmit: server version matches form ─────────────────────────
  describe('server version matches form version', () => {
    it('calls onSubmit when timestamps are equal', async () => {
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_SAME },
      });
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(onSubmit);
      });

      expect(mockedGet).toHaveBeenCalledWith('/outages/abc-123');
      expect(onSubmit).toHaveBeenCalledOnce();
      expect(result.current.conflict).toBeNull();
      expect(result.current.checkError).toBeNull();
    });

    it('calls onSubmit when server version is older', async () => {
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_OLDER },
      });
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(onSubmit);
      });

      expect(onSubmit).toHaveBeenCalledOnce();
      expect(result.current.conflict).toBeNull();
    });
  });

  // ─── guardedSubmit: server version is newer (conflict) ──────────────────
  describe('server version is newer than form version', () => {
    it('sets conflict and does NOT call onSubmit', async () => {
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_NEWER },
      });
      const onSubmit = vi.fn();

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(onSubmit);
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.conflict).toEqual({
        formUpdatedAt: FORM_UPDATED_AT,
        serverUpdatedAt: SERVER_NEWER,
      });
    });

    it('exposes correct timestamps in conflict object', async () => {
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_NEWER },
      });

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(vi.fn());
      });

      expect(result.current.conflict?.formUpdatedAt).toBe(FORM_UPDATED_AT);
      expect(result.current.conflict?.serverUpdatedAt).toBe(SERVER_NEWER);
    });
  });

  // ─── guardedSubmit: API error ───────────────────────────────────────────
  describe('API error during freshness check', () => {
    it('sets checkError and does NOT call onSubmit', async () => {
      mockedGet.mockRejectedValueOnce(new Error('Network failure'));
      const onSubmit = vi.fn();

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(onSubmit);
      });

      expect(onSubmit).not.toHaveBeenCalled();
      expect(result.current.checkError).toBe('Network failure');
      expect(result.current.conflict).toBeNull();
    });

    it('uses fallback message for non-Error throws', async () => {
      mockedGet.mockRejectedValueOnce('string-error');

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(vi.fn());
      });

      expect(result.current.checkError).toBe(
        'Failed to verify record freshness'
      );
    });
  });

  // ─── dismissConflict ────────────────────────────────────────────────────
  describe('dismissConflict', () => {
    it('clears the conflict state', async () => {
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_NEWER },
      });

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(vi.fn());
      });
      expect(result.current.conflict).not.toBeNull();

      act(() => {
        result.current.dismissConflict();
      });

      expect(result.current.conflict).toBeNull();
    });
  });

  // ─── forceSubmit ────────────────────────────────────────────────────────
  describe('forceSubmit', () => {
    it('invokes the original onSubmit after a conflict', async () => {
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_NEWER },
      });
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      // Trigger conflict
      await act(async () => {
        await result.current.guardedSubmit(onSubmit);
      });
      expect(onSubmit).not.toHaveBeenCalled();

      // Force through
      await act(async () => {
        await result.current.forceSubmit();
      });

      expect(onSubmit).toHaveBeenCalledOnce();
      expect(result.current.conflict).toBeNull();
    });

    it('is a no-op when called without a pending submit', async () => {
      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      // Should not throw
      await act(async () => {
        await result.current.forceSubmit();
      });

      expect(result.current.conflict).toBeNull();
    });

    it('clears the pending callback after invocation', async () => {
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_NEWER },
      });
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(onSubmit);
      });

      await act(async () => {
        await result.current.forceSubmit();
      });

      // Calling forceSubmit again should not re-invoke
      await act(async () => {
        await result.current.forceSubmit();
      });

      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });

  // ─── isChecking lifecycle ───────────────────────────────────────────────
  describe('isChecking', () => {
    it('is true while the freshness check is in-flight', async () => {
      let resolveGet!: (v: { data: { updated_at: string } }) => void;
      mockedGet.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveGet = resolve;
        })
      );

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      let submitPromise!: Promise<void>;
      act(() => {
        submitPromise = result.current.guardedSubmit(vi.fn());
      });

      // While awaiting, isChecking should be true
      expect(result.current.isChecking).toBe(true);

      await act(async () => {
        resolveGet({ data: { updated_at: SERVER_SAME } });
        await submitPromise;
      });

      expect(result.current.isChecking).toBe(false);
    });
  });

  // ─── successive calls reset state properly ──────────────────────────────
  describe('successive calls', () => {
    it('clears previous error when a new check succeeds', async () => {
      // First call fails
      mockedGet.mockRejectedValueOnce(new Error('timeout'));

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(vi.fn());
      });
      expect(result.current.checkError).toBe('timeout');

      // Second call succeeds
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_SAME },
      });
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      await act(async () => {
        await result.current.guardedSubmit(onSubmit);
      });

      expect(result.current.checkError).toBeNull();
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    it('clears previous conflict when a new check proceeds', async () => {
      // First call: conflict
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_NEWER },
      });

      const { result } = renderHook(() => useStaleGuard(defaultOpts()));

      await act(async () => {
        await result.current.guardedSubmit(vi.fn());
      });
      expect(result.current.conflict).not.toBeNull();

      // Second call: no conflict (e.g. user refreshed form data)
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_SAME },
      });
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      await act(async () => {
        await result.current.guardedSubmit(onSubmit);
      });

      expect(result.current.conflict).toBeNull();
      expect(onSubmit).toHaveBeenCalledOnce();
    });
  });

  // ─── endpoint correctness ──────────────────────────────────────────────
  describe('endpoint usage', () => {
    it('calls the correct endpoint', async () => {
      mockedGet.mockResolvedValueOnce({
        data: { updated_at: SERVER_SAME },
      });

      const { result } = renderHook(() =>
        useStaleGuard({
          endpoint: '/outages/custom-id-456',
          formUpdatedAt: FORM_UPDATED_AT,
        })
      );

      await act(async () => {
        await result.current.guardedSubmit(vi.fn());
      });

      expect(mockedGet).toHaveBeenCalledWith('/outages/custom-id-456');
    });
  });
});
