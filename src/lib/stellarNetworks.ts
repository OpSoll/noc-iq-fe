/**
 * Stellar network passphrases and network identity helpers.
 *
 * A transaction signed against one network passphrase is rejected by the
 * other. When a browser wallet sits on Testnet but the console is pointed at
 * Futurenet, the failure surfaces only at submission time as an opaque
 * `tx_bad_auth`, which is painful to debug from the console UI alone.
 *
 * Closes #656 — network passphrase mismatch detection.
 */

export type StellarNetworkId = 'public' | 'testnet' | 'futurenet';

export interface StellarNetworkDescriptor {
  id: StellarNetworkId;
  /** Human label rendered in banners and pickers. */
  label: string;
  /** Canonical network passphrase as defined by the Stellar protocol. */
  passphrase: string;
}

/** Canonical passphrases, keyed by network id. */
export const STELLAR_NETWORKS: Record<
  StellarNetworkId,
  StellarNetworkDescriptor
> = {
  public: {
    id: 'public',
    label: 'Mainnet',
    passphrase: 'Public Global Stellar Network ; September 2015',
  },
  testnet: {
    id: 'testnet',
    label: 'Testnet',
    passphrase: 'Test SDF Network ; September 2015',
  },
  futurenet: {
    id: 'futurenet',
    label: 'Futurenet',
    passphrase: 'Test SDF Future Network ; October 2022',
  },
};

export const STELLAR_NETWORK_IDS = Object.keys(
  STELLAR_NETWORKS
) as StellarNetworkId[];

/**
 * The passphrase currently selected in the console. The console persists its
 * target network separately from the browser wallet, so the mismatch check
 * needs both values side by side.
 */
export const ACTIVE_CONSOLE_NETWORK_KEY = 'noc_console_network';

/**
 * Normalises a passphrase for comparison. Trimming and collapsing inner
 * whitespace makes the check tolerant of copy/paste and env-var padding while
 * still being strict about the passphrase itself, which is what actually
 * matters.
 */
export function normalizePassphrase(passphrase: string | null | undefined) {
  return (passphrase ?? '').trim().replace(/\s+/g, ' ');
}

export function isValidNetworkId(value: string): value is StellarNetworkId {
  return value in STELLAR_NETWORKS;
}

export function getNetworkById(id: StellarNetworkId) {
  return STELLAR_NETWORKS[id];
}

export function getNetworkByPassphrase(
  passphrase: string | null | undefined
): StellarNetworkDescriptor | null {
  const normalized = normalizePassphrase(passphrase);
  if (!normalized) return null;
  return (
    STELLAR_NETWORK_IDS.map((id) => STELLAR_NETWORKS[id]).find(
      (network) => normalizePassphrase(network.passphrase) === normalized
    ) ?? null
  );
}

export function getNetworkLabel(id: StellarNetworkId) {
  return STELLAR_NETWORKS[id].label;
}

/**
 * Core comparison used by the mismatch banner.
 *
 * Returns `null` when the two passphrases agree (including the case where
 * neither side is known yet), and a descriptor of the problem when they
 * differ. Unknown passphrases are still compared literally so a custom
 * network shows up as a mismatch rather than silently passing.
 */
export interface NetworkMismatch {
  walletNetwork: StellarNetworkDescriptor | null;
  consoleNetwork: StellarNetworkDescriptor | null;
  /** Raw passphrase reported by the wallet, useful for custom networks. */
  walletPassphrase: string;
  consolePassphrase: string;
}

export function detectNetworkMismatch(
  walletPassphrase: string | null | undefined,
  consolePassphrase: string | null | undefined
): NetworkMismatch | null {
  const wallet = normalizePassphrase(walletPassphrase);
  const console_ = normalizePassphrase(consolePassphrase);

  if (!wallet || !console_) return null;
  if (wallet === console_) return null;

  return {
    walletNetwork: getNetworkByPassphrase(wallet),
    consoleNetwork: getNetworkByPassphrase(console_),
    walletPassphrase: wallet,
    consolePassphrase: console_,
  };
}

export function isNetworkMismatch(
  walletPassphrase: string | null | undefined,
  consolePassphrase: string | null | undefined
) {
  return detectNetworkMismatch(walletPassphrase, consolePassphrase) !== null;
}

/** Reads the console's active network passphrase from local storage. */
export function readConsolePassphrase(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_CONSOLE_NETWORK_KEY);
  } catch {
    // Safari in private mode throws on storage access.
    return null;
  }
}

export function writeConsolePassphrase(passphrase: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_CONSOLE_NETWORK_KEY, passphrase);
  } catch {
    // Storage unavailable — the console simply keeps the previous value.
  }
}
