"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMutationToast } from "@/hooks/useMutationToast";
import { queryKeys } from "@/lib/queryKeys";
import { createWallet, linkWallet, type CreateWalletPayload, type LinkWalletPayload } from "@/services/wallet";
import { getWalletErrorMessage } from "@/lib/mutationFeedback";

export function useCreateWallet() {
  const qc = useQueryClient();

  return useMutationToast({
    mutationFn: (payload: CreateWalletPayload) => createWallet(payload),
    successMessage: "Wallet created successfully.",
    errorMessage: (error: unknown) => getWalletErrorMessage(error),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.all });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.detail(variables.user_id) });
    },
  });
}

export function useLinkWallet() {
  const qc = useQueryClient();

  return useMutationToast({
    mutationFn: (payload: LinkWalletPayload) => linkWallet(payload),
    successMessage: "Wallet linked successfully.",
    errorMessage: (error: unknown) => getWalletErrorMessage(error),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.all });
      void qc.invalidateQueries({ queryKey: queryKeys.wallet.detail(variables.user_id) });
    },
  });
}
