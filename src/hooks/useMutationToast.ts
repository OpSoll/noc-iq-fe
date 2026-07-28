"use client";

import { useToast } from "@/components/ui/toast";
import {
  type UseMutationOptions,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import { getWalletErrorMessage } from "@/lib/mutationFeedback";

type ToastVariant = "success" | "error" | "info";

interface MutationToastOptions<TData, TError, TVariables>
  extends Omit<UseMutationOptions<TData, TError, TVariables>, "onSuccess" | "onError"> {
  successMessage?: string | ((data: TData) => string);
  errorMessage?: string | ((error: TError) => string);
  onSuccess?: UseMutationOptions<TData, TError, TVariables>["onSuccess"];
  onError?: UseMutationOptions<TData, TError, TVariables>["onError"];
}

export function useMutationToast<TData, TError, TVariables>(
  options: MutationToastOptions<TData, TError, TVariables>,
): UseMutationResult<TData, TError, TVariables> {
  const toast = useToast();
  const { onSuccess: userOnSuccess, onError: userOnError, successMessage, errorMessage, ...rest } = options;

  return useMutation({
    ...rest,
    onSuccess: (data, variables, context, mutation) => {
      const msg =
        typeof successMessage === "function"
          ? successMessage(data)
          : successMessage ?? "Action completed successfully";
      toast(msg, "success" as ToastVariant);
      userOnSuccess?.(data, variables, context, mutation);
    },
    onError: (error, variables, context, mutation) => {
      const msg =
        typeof errorMessage === "function"
          ? errorMessage(error)
          : errorMessage ?? getWalletErrorMessage(error);
      toast(msg, "error" as ToastVariant);
      userOnError?.(error, variables, context, mutation);
    },
  });
}
