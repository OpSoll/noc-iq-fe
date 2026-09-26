import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useOptimisticStatusAndFocusRestore } from './useOptimisticStatusAndFocusRestore';

const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/components/ui/toast', () => ({
  useToast: () => mockToast,
}));

interface StatusItem {
  id: string;
  status: string;
}

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((_resolve, rejectPromise) => {
    reject = rejectPromise;
  });
  return { promise, reject };
}

describe('useOptimisticStatusAndFocusRestore', () => {
  beforeEach(() => mockToast.mockClear());

  it('updates status immediately and rolls it back with an error toast when the API fails', async () => {
    const queryKey = ['status-items'];
    const initialItems: StatusItem[] = [{ id: 'item-1', status: 'open' }];
    const pendingRequest = deferred<StatusItem>();
    const updateStatus = vi.fn(() => pendingRequest.promise);
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    queryClient.setQueryData(queryKey, initialItems);

    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    }

    const { result } = renderHook(
      () => useOptimisticStatusAndFocusRestore(queryKey, updateStatus, false),
      { wrapper: Wrapper }
    );

    act(() => {
      result.current.mutate({ id: 'item-1', status: 'resolved' });
    });

    expect(queryClient.getQueryData<StatusItem[]>(queryKey)?.[0].status).toBe(
      'resolved'
    );
    await waitFor(() => expect(updateStatus).toHaveBeenCalled());

    pendingRequest.reject(new Error('Could not update status.'));

    await waitFor(() => {
      expect(queryClient.getQueryData<StatusItem[]>(queryKey)?.[0].status).toBe(
        'open'
      );
      expect(mockToast).toHaveBeenCalledWith(
        'Could not update status.',
        'error'
      );
    });

    queryClient.clear();
  });
});
