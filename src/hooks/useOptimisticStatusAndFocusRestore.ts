import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
// Closes #345: optimistic UI updates for outage status changes
// Closes #346: focus restoration when a modal/drawer closes

export function useOptimisticStatusUpdate<T extends { id: string; status: string }>(
  queryKey: unknown[],
  mutateFn: (id: string, status: string) => Promise<T>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => mutateFn(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<T[]>(queryKey);
      queryClient.setQueryData<T[]>(queryKey, (old) =>
        old?.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
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
