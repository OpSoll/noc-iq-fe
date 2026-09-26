import { useEffect, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast';
// Closes #345: optimistic UI updates for outage status changes
// Closes #346: focus restoration when a modal/drawer closes

export function useOptimisticStatusUpdate<
  T extends { id: string; status: string },
>(queryKey: unknown[], mutateFn: (id: string, status: string) => Promise<T>) {
  const queryClient = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      mutateFn(id, status),
    onMutate: ({ id, status }) => {
      // Start cancellation immediately, then update the cache before yielding
      // so controlled status switches render their new value in this turn.
      void queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<T[]>(queryKey);
      queryClient.setQueryData<T[]>(queryKey, (old) =>
        old?.map((item) => (item.id === id ? { ...item, status } : item))
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous !== undefined)
        queryClient.setQueryData(queryKey, context.previous);
      toast(
        error instanceof Error ? error.message : 'Failed to update status.',
        'error'
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

/** Combines optimistic status updates with focus restoration for closing UI. */
export function useOptimisticStatusAndFocusRestore<
  T extends { id: string; status: string },
>(
  queryKey: unknown[],
  mutateFn: (id: string, status: string) => Promise<T>,
  isOpen: boolean
) {
  useFocusRestore(isOpen);
  return useOptimisticStatusUpdate(queryKey, mutateFn);
}

export function useFocusRestore(isOpen: boolean) {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
    } else {
      previouslyFocused.current?.focus();
    }
  }, [isOpen]);
}
