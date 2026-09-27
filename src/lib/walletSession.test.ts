import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  WALLET_SESSION_KEYS,
  clearWalletSession,
  readWalletSession,
  saveWalletSession,
} from '@/lib/walletSession';

describe('walletSession', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  describe('saveWalletSession', () => {
    it('persists the public key and connection metadata', () => {
      saveWalletSession({
        publicKey: 'GABC',
        passphrase: 'Test SDF Network ; September 2015',
        network: 'TESTNET',
      });

      expect(window.sessionStorage.getItem('noc_wallet_public_key')).toBe('GABC');
      expect(window.sessionStorage.getItem('noc_wallet_passphrase')).toBe(
        'Test SDF Network ; September 2015'
      );
      expect(window.sessionStorage.getItem('noc_wallet_network')).toBe(
        'TESTNET'
      );
      expect(window.sessionStorage.getItem('noc_wallet_connected_at')).toBeTruthy();
    });

    it('omits optional fields that were not supplied', () => {
      saveWalletSession({ publicKey: 'GABC' });
      expect(window.sessionStorage.getItem('noc_wallet_passphrase')).toBeNull();
      expect(window.sessionStorage.getItem('noc_wallet_secret')).toBeNull();
    });
  });

  describe('readWalletSession', () => {
    it('returns the public key when a session exists', () => {
      saveWalletSession({ publicKey: 'GABC' });
      expect(readWalletSession()).toEqual({ publicKey: 'GABC' });
    });

    it('returns null when there is no session', () => {
      expect(readWalletSession()).toBeNull();
    });
  });

  describe('clearWalletSession', () => {
    it('removes every wallet key and reports which were present', () => {
      saveWalletSession({
        publicKey: 'GABC',
        passphrase: 'p',
        network: 'n',
        secret: 's',
      });
      // An unrelated key must survive.
      window.sessionStorage.setItem('unrelated', 'keep-me');

      const cleared = clearWalletSession();

      for (const key of WALLET_SESSION_KEYS) {
        expect(window.sessionStorage.getItem(key)).toBeNull();
        expect(cleared).toContain(key);
      }
      expect(window.sessionStorage.getItem('unrelated')).toBe('keep-me');
    });

    it('returns an empty list when there was nothing to clear', () => {
      expect(clearWalletSession()).toEqual([]);
    });

    it('only reports keys that actually existed', () => {
      saveWalletSession({ publicKey: 'GABC' });
      const cleared = clearWalletSession();
      expect(cleared).toEqual(['noc_wallet_public_key', 'noc_wallet_connected_at']);
    });
  });
});
