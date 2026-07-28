import { api } from "@/lib/api";

export interface Wallet {
  user_id: string;
  public_key: string;
  created_at: string;
  last_updated: string;
  funded: boolean;
  active: boolean;
  trustline_ready: boolean;
  message?: string;
}

export interface WalletStatus {
  user_id: string;
  public_key: string;
  funded: boolean;
  trustline_ready: boolean;
  usable: boolean;
  active: boolean;
  last_updated: string;
}

export interface WalletBalance {
  address: string;
  balances: Record<
    string,
    {
      balance: string;
      asset_type: string;
      asset_code?: string;
      asset_issuer?: string;
    }
  >;
  last_updated: string;
}

export interface CreateWalletPayload {
  user_id: string;
}

export interface LinkWalletPayload {
  user_id: string;
  public_key: string;
  funded?: boolean;
  trustline_ready?: boolean;
}

export async function getWalletDetail(
  userId: string,
  options?: { signal?: AbortSignal },
): Promise<Wallet> {
  const { data } = await api.get<Wallet>(`/wallets/${userId}`, {
    signal: options?.signal,
  });
  return data;
}

export async function getWalletStatus(
  userId: string,
  options?: { signal?: AbortSignal },
): Promise<WalletStatus> {
  const { data } = await api.get<WalletStatus>(`/wallets/${userId}/status`, {
    signal: options?.signal,
  });
  return data;
}

export async function getWalletBalance(
  address: string,
  options?: { signal?: AbortSignal },
): Promise<WalletBalance> {
  const { data } = await api.get<WalletBalance>(`/wallets/${address}/balance`, {
    signal: options?.signal,
  });
  return data;
}

export async function createWallet(
  payload: CreateWalletPayload,
): Promise<Wallet> {
  const { data } = await api.post<Wallet>("/wallets/create", payload);
  return data;
}

export async function linkWallet(
  payload: LinkWalletPayload,
): Promise<Wallet> {
  const { data } = await api.post<Wallet>("/wallets/link", payload);
  return data;
}
