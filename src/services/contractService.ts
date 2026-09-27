import { api } from '@/lib/api';
import { normalizeApiError } from '@/lib/normalizeApiError';

/**
 * Custom Soroban token contract lookups used by the token tracker modal.
 *
 * Contract reads are proxied through the platform API (`/contracts/:id/...`),
 * which performs the Soroban RPC call server-side. That keeps the RPC host,
 * credentials, and rate limiting in one place instead of duplicating them in
 * the browser, and sidesteps having to build base64 XDR `SorobanTransaction`
 * payloads for read-only simulations.
 *
 * Closes #659 — custom SAC/token contract address tracker.
 */

/** Soroban RPC endpoint per network, exposed for diagnostics and tests. */
const SOROBAN_RPC_URLS = {
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://soroban-futurenet.stellar.org',
  mainnet: 'https://mainnet.sorobanrpc.com',
} as const;

export type SorobanNetwork = keyof typeof SOROBAN_RPC_URLS;

export function getSorobanRpcUrl(network: SorobanNetwork = 'testnet') {
  return SOROBAN_RPC_URLS[network];
}

export interface ContractAssetInfo {
  symbol: string;
  decimals: number;
  issuer?: string;
}

/**
 * Reads a token contract's `symbol` / `decimals` metadata.
 * Throws with a human-readable message so the modal can surface it directly.
 */
export async function getContractAssetInfo(
  contractId: string,
  options?: { signal?: AbortSignal }
): Promise<ContractAssetInfo> {
  try {
    const { data } = await api.get<ContractAssetInfo>(
      `/contracts/${contractId}/asset-info`,
      { signal: options?.signal }
    );
    return data;
  } catch (err) {
    throw new Error(
      `Could not read metadata for contract ${contractId.slice(0, 6)}…: ${
        normalizeApiError(err).message
      }`
    );
  }
}

/** Reads `balanceOf(owner)` from a token contract, as a raw integer string. */
export async function getContractBalance(
  contractId: string,
  owner: string,
  options?: { signal?: AbortSignal }
): Promise<string> {
  try {
    const { data } = await api.get<{ balance: string }>(
      `/contracts/${contractId}/balance`,
      { signal: options?.signal, params: { owner } }
    );
    return data.balance;
  } catch (err) {
    throw new Error(
      `Could not read balance for contract ${contractId.slice(0, 6)}…: ${
        normalizeApiError(err).message
      }`
    );
  }
}
