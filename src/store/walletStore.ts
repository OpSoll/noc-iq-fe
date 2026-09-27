import { create } from 'zustand';

import {
  clearWalletSession,
  saveWalletSession,
  type WalletSessionKey,
} from '@/lib/walletSession';

/**
 * Wallet connection state shared by the payments, config, and wallet UIs.
 *
 * The store is the single source of truth for "is a wallet connected", so a
 * disconnect genuinely returns the app to its unauthenticated default rather
 * than leaving a stale public key in a component's local `useState`.
 *
 * Closes #657 — wallet disconnect with session state cleanup.
 * Closes #659 — tracked custom token contracts persist in the workspace store.
 */

export interface TrackedToken {
  /** Soroban contract ID of the custom token. */
  contractId: string;
  symbol: string;
  /** Raw contract balance as reported by RPC, or null while still loading. */
  balance: string | null;
  decimals: number;
  issuer?: string;
  addedAt: string;
}

interface WalletState {
  publicKey: string | null;
  /** Network passphrase reported by the browser wallet. */
  passphrase: string | null;
  network: string | null;
  isConnecting: boolean;
  isDisconnecting: boolean;
  trackedTokens: TrackedToken[];

  connect: (session: {
    publicKey: string;
    passphrase?: string;
    network?: string;
  }) => void;
  setConnecting: (isConnecting: boolean) => void;
  /** Resets to the unauthenticated default and wipes session storage. */
  disconnect: () => WalletSessionKey[];

  addTrackedToken: (token: TrackedToken) => void;
  removeTrackedToken: (contractId: string) => void;
  updateTrackedToken: (
    contractId: string,
    patch: Partial<Omit<TrackedToken, 'contractId'>>
  ) => void;
}

const UNAUTHENTICATED = {
  publicKey: null,
  passphrase: null,
  network: null,
  isConnecting: false,
  isDisconnecting: false,
} as const;

export const useWalletStore = create<WalletState>((set, get) => ({
  ...UNAUTHENTICATED,
  trackedTokens: [],

  connect: ({ publicKey, passphrase, network }) => {
    saveWalletSession({ publicKey, passphrase, network });
    set({
      publicKey,
      passphrase: passphrase ?? null,
      network: network ?? null,
      isConnecting: false,
      isDisconnecting: false,
    });
  },

  setConnecting: (isConnecting) => set({ isConnecting }),

  disconnect: () => {
    set({ ...UNAUTHENTICATED, isDisconnecting: false });
    // Tracked token contracts are a workspace preference, not session
    // material, so they intentionally survive a disconnect.
    const cleared = clearWalletSession();
    // Keep the store reachable for callers that want to assert on cleanup.
    if (get().publicKey !== null) set({ publicKey: null });
    return cleared;
  },

  addTrackedToken: (token) =>
    set((state) => ({
      trackedTokens: [
        ...state.trackedTokens.filter(
          (t) => t.contractId !== token.contractId
        ),
        token,
      ],
    })),

  removeTrackedToken: (contractId) =>
    set((state) => ({
      trackedTokens: state.trackedTokens.filter(
        (t) => t.contractId !== contractId
      ),
    })),

  updateTrackedToken: (contractId, patch) =>
    set((state) => ({
      trackedTokens: state.trackedTokens.map((token) =>
        token.contractId === contractId ? { ...token, ...patch } : token
      ),
    })),
}));
