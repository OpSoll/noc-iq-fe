import { describe, it, expect } from 'vitest';

import {
  CONTRACT_ID_ERROR,
  formatContractBalance,
  isValidContractId,
  parseAssetMetadata,
  validateContractId,
} from '@/lib/contractTokens';

const VALID_CONTRACT =
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

describe('validateContractId', () => {
  it('accepts a 56-character lowercase base32 contract ID', () => {
    expect(isValidContractId(VALID_CONTRACT)).toBe(true);
    expect(validateContractId(VALID_CONTRACT)).toBeNull();
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateContractId(`  ${VALID_CONTRACT}  `)).toBeNull();
  });

  it('requires a value', () => {
    expect(validateContractId('')).toBe('Contract ID is required');
    expect(validateContractId('   ')).toBe('Contract ID is required');
  });

  it('rejects the wrong length', () => {
    expect(validateContractId(VALID_CONTRACT.slice(0, 55))).toBe(
      CONTRACT_ID_ERROR
    );
    expect(validateContractId(`${VALID_CONTRACT}A`)).toBe(CONTRACT_ID_ERROR);
  });

  it('rejects characters outside the base32 alphabet', () => {
    // 0, 1, 8, 9 and uppercase are not in the lowercase base32 alphabet.
    expect(isValidContractId('0'.repeat(56))).toBe(false);
    expect(isValidContractId('1'.repeat(56))).toBe(false);
    expect(isValidContractId('8'.repeat(56))).toBe(false);
    expect(isValidContractId('A'.repeat(56))).toBe(false);
    expect(isValidContractId(VALID_CONTRACT.replace(/^C/, '0'))).toBe(false);
  });
});

describe('parseAssetMetadata', () => {
  it('reads a well-formed metadata object', () => {
    expect(
      parseAssetMetadata({ symbol: 'USDC', decimals: 6, issuer: 'GABC' })
    ).toEqual({ symbol: 'USDC', decimals: 6, issuer: 'GABC' });
  });

  it('coerces a stringified decimals value', () => {
    expect(parseAssetMetadata({ symbol: 'XLM', decimals: '7' })).toEqual({
      symbol: 'XLM',
      decimals: 7,
      issuer: undefined,
    });
  });

  it('falls back to safe defaults for a missing contract', () => {
    expect(parseAssetMetadata(undefined)).toEqual({
      symbol: 'UNKNOWN',
      decimals: 7,
      issuer: undefined,
    });
    expect(parseAssetMetadata({})).toEqual({
      symbol: 'UNKNOWN',
      decimals: 7,
      issuer: undefined,
    });
  });

  it('never returns a negative or fractional decimals value', () => {
    expect(parseAssetMetadata({ symbol: 'X', decimals: -3 }).decimals).toBe(0);
    expect(parseAssetMetadata({ symbol: 'X', decimals: 6.9 }).decimals).toBe(6);
  });

  it('ignores non-numeric decimals', () => {
    expect(
      parseAssetMetadata({ symbol: 'X', decimals: 'abc' }).decimals
    ).toBe(7);
  });
});

describe('formatContractBalance', () => {
  it('applies the token decimals to a raw integer balance', () => {
    expect(formatContractBalance('1000000', 6)).toBe('1');
    expect(formatContractBalance('1234500', 6)).toBe('1.2345');
    expect(formatContractBalance('1', 7)).toBe('0.0000001');
  });

  it('handles zero and decimals of 0', () => {
    expect(formatContractBalance('0', 6)).toBe('0');
    expect(formatContractBalance('42', 0)).toBe('42');
  });

  it('trims trailing fractional zeros', () => {
    expect(formatContractBalance('1001000', 6)).toBe('1.001');
  });

  it('returns null for missing or non-numeric balances', () => {
    expect(formatContractBalance(null, 6)).toBeNull();
    expect(formatContractBalance(undefined, 6)).toBeNull();
    expect(formatContractBalance('', 6)).toBeNull();
    expect(formatContractBalance('abc', 6)).toBeNull();
    expect(formatContractBalance('-5', 6)).toBeNull();
  });
});
