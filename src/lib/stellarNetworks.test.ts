import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  STELLAR_NETWORKS,
  detectNetworkMismatch,
  getNetworkByPassphrase,
  isNetworkMismatch,
  normalizePassphrase,
  readConsolePassphrase,
  writeConsolePassphrase,
  ACTIVE_CONSOLE_NETWORK_KEY,
  type StellarNetworkId,
} from '@/lib/stellarNetworks';

describe('stellarNetworks', () => {
  describe('canonical passphrases', () => {
    it('exposes the protocol passphrase for each supported network', () => {
      expect(STELLAR_NETWORKS.public.passphrase).toBe(
        'Public Global Stellar Network ; September 2015'
      );
      expect(STELLAR_NETWORKS.testnet.passphrase).toBe(
        'Test SDF Network ; September 2015'
      );
      expect(STELLAR_NETWORKS.futurenet.passphrase).toBe(
        'Test SDF Future Network ; October 2022'
      );
    });

    it('resolves a network back from its passphrase', () => {
      expect(getNetworkByPassphrase(STELLAR_NETWORKS.futurenet.passphrase)?.id).toBe(
        'futurenet'
      );
      expect(getNetworkByPassphrase('nonsense')).toBeNull();
      expect(getNetworkByPassphrase(null)).toBeNull();
    });
  });

  describe('normalizePassphrase', () => {
    it('trims and collapses whitespace so env-var padding is tolerated', () => {
      expect(normalizePassphrase('  Test SDF Network ;   September 2015  ')).toBe(
        'Test SDF Network ; September 2015'
      );
    });

    it('treats null and undefined as empty', () => {
      expect(normalizePassphrase(null)).toBe('');
      expect(normalizePassphrase(undefined)).toBe('');
    });
  });

  describe('detectNetworkMismatch', () => {
    it('returns null when both passphrases match', () => {
      expect(
        detectNetworkMismatch(
          STELLAR_NETWORKS.testnet.passphrase,
          STELLAR_NETWORKS.testnet.passphrase
        )
      ).toBeNull();
    });

    it('returns null when the match survives whitespace normalisation', () => {
      expect(
        isNetworkMismatch(
          'Test SDF Network ; September 2015',
          '  Test SDF Network ;   September 2015 '
        )
      ).toBe(false);
    });

    it('returns null when either side is unknown, so we do not nag pre-connect', () => {
      expect(detectNetworkMismatch(null, STELLAR_NETWORKS.testnet.passphrase)).toBeNull();
      expect(detectNetworkMismatch(STELLAR_NETWORKS.testnet.passphrase, '')).toBeNull();
      expect(detectNetworkMismatch(null, null)).toBeNull();
    });

    it('flags testnet wallet against a futurenet console', () => {
      const mismatch = detectNetworkMismatch(
        STELLAR_NETWORKS.testnet.passphrase,
        STELLAR_NETWORKS.futurenet.passphrase
      );

      expect(mismatch).not.toBeNull();
      expect(mismatch?.walletNetwork?.id).toBe('testnet');
      expect(mismatch?.consoleNetwork?.id).toBe('futurenet');
    });

    it('flags mainnet wallet against a testnet console', () => {
      const mismatch = detectNetworkMismatch(
        STELLAR_NETWORKS.public.passphrase,
        STELLAR_NETWORKS.testnet.passphrase
      );
      expect(mismatch?.walletNetwork?.id).toBe('public');
      expect(mismatch?.consoleNetwork?.id).toBe('testnet');
    });

    it('still flags a custom network whose passphrase matches no known network', () => {
      const mismatch = detectNetworkMismatch(
        'My Private Network ; January 2024',
        STELLAR_NETWORKS.testnet.passphrase
      );

      expect(mismatch).not.toBeNull();
      expect(mismatch?.walletNetwork).toBeNull();
      expect(mismatch?.consoleNetwork?.id).toBe('testnet');
      expect(mismatch?.walletPassphrase).toBe('My Private Network ; January 2024');
    });
  });

  describe('console network persistence', () => {
    const id: StellarNetworkId = 'futurenet';

    beforeEach(() => {
      window.localStorage.clear();
    });

    afterEach(() => {
      window.localStorage.clear();
    });

    it('round-trips the active console passphrase', () => {
      writeConsolePassphrase(STELLAR_NETWORKS[id].passphrase);
      expect(readConsolePassphrase()).toBe(STELLAR_NETWORKS[id].passphrase);
    });

    it('returns null when nothing has been stored', () => {
      expect(readConsolePassphrase()).toBeNull();
      expect(window.localStorage.getItem(ACTIVE_CONSOLE_NETWORK_KEY)).toBeNull();
    });
  });
});
