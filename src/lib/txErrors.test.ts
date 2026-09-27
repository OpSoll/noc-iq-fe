import { describe, it, expect } from 'vitest';

import { classifyTxError, explainTxError, type TxErrorCode } from '@/lib/txErrors';

describe('classifyTxError', () => {
  const cases: Array<[string, TxErrorCode]> = [
    ['tx_insufficient_balance', 'insufficient_balance'],
    ['Transaction failed: tx_insufficient_balance', 'insufficient_balance'],
    ['entry_too_expensive', 'entry_too_expensive'],
    ['tx_insufficient_fee', 'tx_insufficient_fee'],
    ['tx_too_early', 'tx_too_early'],
    ['tx_too_late', 'tx_too_late'],
    ['tx_bad_auth', 'tx_bad_auth'],
    ['tx_malformed', 'tx_malformed'],
    ['tx_failed', 'tx_failed'],
    ['HostError: Error(Host, #1)', 'soroban_host_error'],
    ['host error while simulating', 'soroban_host_error'],
    ['exceeded budget', 'soroban_host_error'],
    ['Error(Contract, #42)', 'contract_error'],
    ['contracterror! #7', 'contract_error'],
    ['insufficient fee', 'insufficient_fee'],
    ['not_found', 'not_found'],
    ['Resource not found', 'not_found'],
  ];

  it.each(cases)('classifies %s as %s', (raw, expected) => {
    expect(classifyTxError(raw)).toBe(expected);
  });

  it('matches case-insensitively', () => {
    expect(classifyTxError('TX_INSUFFICIENT_BALANCE')).toBe('insufficient_balance');
    expect(classifyTxError('Tx_Too_Early')).toBe('tx_too_early');
  });

  it('falls back to unknown for unrecognised and empty errors', () => {
    expect(classifyTxError('something else entirely')).toBe('unknown');
    expect(classifyTxError('')).toBe('unknown');
    expect(classifyTxError('   ')).toBe('unknown');
    expect(classifyTxError(null)).toBe('unknown');
    expect(classifyTxError(undefined)).toBe('unknown');
  });

  it('prefers the more specific rule over the generic one', () => {
    // "insufficient fee" must not be swallowed by a balance rule.
    expect(classifyTxError('tx_insufficient_fee')).toBe('tx_insufficient_fee');
    expect(classifyTxError('insufficient fee')).toBe('insufficient_fee');
  });
});

describe('explainTxError', () => {
  it('returns a title, description, remedy, and docs link for every code', () => {
    const codes: TxErrorCode[] = [
      'insufficient_balance',
      'insufficient_fee',
      'expired_footprint',
      'tx_too_early',
      'tx_too_late',
      'tx_failed',
      'tx_malformed',
      'tx_bad_auth',
      'tx_insufficient_fee',
      'soroban_host_error',
      'contract_error',
      'entry_too_expensive',
      'not_found',
      'unknown',
    ];

    for (const code of codes) {
      const explanation = explainTxError(code);
      expect(explanation.code).toBe(code);
      expect(explanation.title.length).toBeGreaterThan(0);
      expect(explanation.description.length).toBeGreaterThan(0);
      expect(explanation.remedy.length).toBeGreaterThan(0);
      expect(explanation.docsUrl).toMatch(/^https:\/\//);
      expect(explanation.docsLabel.length).toBeGreaterThan(0);
    }
  });

  it('suggests adding XLM for a reserve shortfall', () => {
    const explanation = explainTxError('tx_insufficient_balance');
    expect(explanation.title).toMatch(/minimum reserve/i);
    expect(explanation.remedy).toMatch(/fund/i);
    expect(explanation.remedy).toMatch(/trustline|data entry/i);
  });

  it('points at the network when authentication fails', () => {
    const explanation = explainTxError('tx_bad_auth');
    expect(explanation.remedy).toMatch(/same network/i);
  });

  it('points at the contract error enum for contract failures', () => {
    const explanation = explainTxError('Error(Contract, #42)');
    expect(explanation.remedy).toMatch(/error enum/i);
    expect(explanation.docsUrl).toMatch(/soroban/i);
  });

  it('still returns usable guidance for an unrecognised error', () => {
    const explanation = explainTxError('gibberish');
    expect(explanation.code).toBe('unknown');
    expect(explanation.title).toBe('Unrecognised error');
    expect(explanation.docsUrl).toBeTruthy();
  });
});
