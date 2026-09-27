/**
 * Wallet session lifecycle helpers.
 *
 * Disconnecting has to clear more than the in-memory public key: the app
 * also caches the connected address, its passphrase, and any secret material
 * (so a page refresh can restore the session) in `sessionStorage`. Leaving
 * those behind means a keypair reference survives the disconnect and is
 * still readable by anything running on the page.
 *
 * Closes #657 — wallet disconnect with session state cleanup.
 */

/** Every `sessionStorage` key this app writes for the wallet session. */
export const WALLET_SESSION_KEYS = [
  'noc_wallet_public_key',
  'noc_wallet_passphrase',
  'noc_wallet_network',
  'noc_wallet_secret',
  'noc_wallet_connected_at',
] as const;

export type WalletSessionKey = (typeof WALLET_SESSION_KEYS)[number];

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    // Access to sessionStorage throws in sandboxed iframes and some privacy
    // modes. Treat it as "nothing to clear" rather than breaking disconnect.
    return null;
  }
}

/** Persists the connected session so a refresh can restore it. */
export function saveWalletSession(session: {
  publicKey: string;
  passphrase?: string;
  network?: string;
  secret?: string;
  connectedAt?: string;
}) {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    storage.setItem('noc_wallet_public_key', session.publicKey);
    if (session.passphrase)
      storage.setItem('noc_wallet_passphrase', session.passphrase);
    if (session.network)
      storage.setItem('noc_wallet_network', session.network);
    if (session.secret)
      storage.setItem('noc_wallet_secret', session.secret);
    storage.setItem(
      'noc_wallet_connected_at',
      session.connectedAt ?? new Date().toISOString()
    );
  } catch {
    // Quota or privacy-mode failures must not block the connection flow.
  }
}

export function readWalletSession(): { publicKey: string } | null {
  const storage = getSessionStorage();
  if (!storage) return null;
  try {
    const publicKey = storage.getItem('noc_wallet_public_key');
    return publicKey ? { publicKey } : null;
  } catch {
    return null;
  }
}

/**
 * Removes every wallet key from session storage.
 * Returns the keys that were actually present, so callers can report or
 * assert on the cleanup.
 */
export function clearWalletSession(): WalletSessionKey[] {
  const storage = getSessionStorage();
  if (!storage) return [];
  const cleared: WalletSessionKey[] = [];
  try {
    for (const key of WALLET_SESSION_KEYS) {
      if (storage.getItem(key) !== null) {
        storage.removeItem(key);
        cleared.push(key);
      }
    }
  } catch {
    // Ignore — the in-memory state has already been reset by the caller.
  }
  return cleared;
}
