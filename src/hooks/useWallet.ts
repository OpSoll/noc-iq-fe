"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { getDomainConfig } from "@/lib/queryConfig";
import {
  getWalletDetail,
  getWalletStatus,
  getWalletBalance,
} from "@/services/wallet";

const walletConfig = getDomainConfig("wallets");

export function useWalletDetail(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wallet.detail(userId ?? ""),
    queryFn: ({ signal }) => getWalletDetail(userId!, { signal }),
    enabled: !!userId,
    ...walletConfig,
    retry: 1,
  });
}

export function useWalletStatus(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wallet.status(userId ?? ""),
    queryFn: ({ signal }) => getWalletStatus(userId!, { signal }),
    enabled: !!userId,
    ...walletConfig,
    retry: 1,
  });
}

export function useWalletBalance(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.wallet.balance(address ?? ""),
    queryFn: ({ signal }) => getWalletBalance(address!, { signal }),
    enabled: !!address,
    ...walletConfig,
    retry: 1,
  });
}
