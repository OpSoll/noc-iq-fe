/**
 * Human-readable explanations for Stellar/Soroban submission failures.
 *
 * A failed pre-flight simulation otherwise reaches the user as a raw code —
 * `HostError: Error(Contract, #1)` — which is close to useless without the
 * contract's error enum. This maps the codes that account for most real
 * failures onto a plain description plus a concrete next step, and links to
 * the relevant protocol documentation.
 *
 * Closes #661 — transaction simulation error explainer.
 */

export interface TxErrorExplanation {
  /** Stable key for the recognised failure, or `null` when unrecognised. */
  code: TxErrorCode | null;
  /** Short human-readable title. */
  title: string;
  /** What went wrong, in plain language. */
  description: string;
  /** What to actually do about it. */
  remedy: string;
  /** Documentation relevant to this failure. */
  docsUrl: string;
  docsLabel: string;
}

export type TxErrorCode =
  | 'insufficient_balance'
  | 'insufficient_fee'
  | 'expired_footprint'
  | 'tx_too_early'
  | 'tx_too_late'
  | 'tx_failed'
  | 'tx_malformed'
  | 'tx_bad_auth'
  | 'tx_insufficient_fee'
  | 'soroban_host_error'
  | 'contract_error'
  | 'entry_too_expensive'
  | 'not_found'
  | 'unknown';

const DOCS_BASE = 'https://developers.stellar.org/docs/learn/encyclopedia/error-codes';

interface ErrorRule {
  title: string;
  description: string;
  remedy: string;
  docsUrl: string;
  docsLabel: string;
}

const SOROBAN_DOCS =
  'https://developers.stellar.org/docs/build/smart-contracts/errors';

const RULES: Record<TxErrorCode, ErrorRule> = {
  insufficient_balance: {
    title: 'Balance does not cover the minimum reserve',
    description:
      'The account holds less XLM than its minimum balance requires. Every subentry (trustline, data entry, offer) locks up additional reserve, so adding entries can push an apparently-funded account under the threshold.',
    remedy:
      'Fund the account, or remove unneeded trustlines and data entries to release reserve.',
    docsUrl: DOCS_BASE,
    docsLabel: 'tx_insufficient_balance',
  },
  insufficient_fee: {
    title: 'Fee is too low',
    description:
      'The transaction fee does not cover the resource footprint the operation needs. Soroban contracts are metered by instruction and write-bytes, not just by the flat base fee.',
    remedy:
      'Re-simulate the transaction and submit the exact fee the simulation returns.',
    docsUrl: `${SOROBAN_DOCS}#resource-fee`,
    docsLabel: 'Soroban resource fees',
  },
  tx_too_early: {
    title: 'Transaction submitted before its valid window',
    description:
      'The transaction is correctly formed but its time bounds have not started yet. This usually means a cached or pre-signed payload was replayed.',
    remedy:
      'Re-sign the transaction so its `validFrom` starts after the ledger close you targeted.',
    docsUrl: DOCS_BASE,
    docsLabel: 'tx_too_early',
  },
  tx_too_late: {
    title: 'Transaction expired before it was included',
    description:
      'The transaction was signed but not submitted before `validUntil`. Pre-signed payloads go stale, especially when a simulation sits in a queue.',
    remedy:
      'Re-simulate and re-sign immediately before submitting, or widen the `validUntil` window.',
    docsUrl: DOCS_BASE,
    docsLabel: 'tx_too_late',
  },
  tx_failed: {
    title: 'Transaction was included but its operations failed',
    description:
      'The fee was charged and the transaction is on-chain, but the contract call returned an error. Inspect the result codes to find which operation failed.',
    remedy:
      'Read the `resultCodes` array on the submitted transaction to identify the failing operation.',
    docsUrl: `${SOROBAN_DOCS}#error-codes`,
    docsLabel: 'Soroban error codes',
  },
  tx_malformed: {
    title: 'Transaction is malformed',
    description:
      'A field the network requires is missing or invalid, such as an empty operation set, a bad signature, or a mismatched source account.',
    remedy:
      'Rebuild the transaction from the simulation response rather than editing a previous payload.',
    docsUrl: DOCS_BASE,
    docsLabel: 'tx_malformed',
  },
  tx_bad_auth: {
    title: 'Signature or account is not valid for this network',
    description:
      'The signature does not match the transaction, or the account has not been configured for the network the transaction targets. A network passphrase mismatch produces exactly this code.',
    remedy:
      'Check that the wallet is on the same network as the console, then re-sign the transaction.',
    docsUrl: DOCS_BASE,
    docsLabel: 'tx_bad_auth',
  },
  tx_insufficient_fee: {
    title: 'Fee does not match the required minimum fee',
    description:
      'The network rejected the transaction because the fee is below the minimum for the current ledger.',
    remedy:
      'Fetch the current minimum fee and resubmit; a stale fee from an earlier simulation will be rejected.',
    docsUrl: DOCS_BASE,
    docsLabel: 'tx_insufficient_fee',
  },
  soroban_host_error: {
    title: 'Soroban host rejected the invocation',
    description:
      'The contract host itself refused the call — typically a missing entry, an exceeded budget, or a panic inside the contract. The host error code follows the `HostError:` prefix.',
    remedy:
      'Read the numeric host code and the contract error enum it maps to, then raise the instruction budget if the failure is budget-related.',
    docsUrl: SOROBAN_DOCS,
    docsLabel: 'Soroban host errors',
  },
  contract_error: {
    title: 'The contract returned an error',
    description:
      'Invocation reached the contract and the contract used `contracterror!` to return a domain-specific code. The number is defined by the contract, not by the protocol.',
    remedy:
      'Look up the number in the contract\'s error enum to get its meaning.',
    docsUrl: SOROBAN_DOCS,
    docsLabel: 'Contract-defined errors',
  },
  entry_too_expensive: {
    title: 'Data entry would cost more to reserve than it is worth',
    description:
      'Adding this data entry would push the account under its minimum balance, so the network refuses to include it.',
    remedy:
      'Fund the account, reduce the entry size, or remove an existing entry to free up reserve.',
    docsUrl: DOCS_BASE,
    docsLabel: 'entry_too_expensive',
  },
  not_found: {
    title: 'Resource not found',
    description:
      'The account, contract, or ledger entry referenced by the transaction does not exist on this network.',
    remedy:
      'Verify the identifier and the network: testnet resources do not exist on mainnet, or vice versa.',
    docsUrl: DOCS_BASE,
    docsLabel: 'not_found',
  },
  unknown: {
    title: 'Unrecognised error',
    description:
      'This code is not one of the commonly-seen Stellar failures. The raw message is shown below so it can be looked up directly.',
    remedy:
      'Check the raw error against the protocol error-code reference and the contract source.',
    docsUrl: DOCS_BASE,
    docsLabel: 'Error code reference',
  },
};

/**
 * Patterns are matched against the lowercased raw error text, in order, so the
 * more specific rules must come first.
 */
const MATCHERS: Array<{ code: TxErrorCode; pattern: RegExp }> = [
  { code: 'insufficient_balance', pattern: /tx_insufficient_balance/ },
  { code: 'entry_too_expensive', pattern: /entry_too_expensive/ },
  { code: 'tx_insufficient_fee', pattern: /tx_insufficient_fee/ },
  { code: 'tx_too_early', pattern: /tx_too_early/ },
  { code: 'tx_too_late', pattern: /tx_too_late/ },
  { code: 'tx_bad_auth', pattern: /tx_bad_auth/ },
  { code: 'tx_malformed', pattern: /tx_malformed/ },
  { code: 'tx_failed', pattern: /tx_failed/ },
  { code: 'not_found', pattern: /not[_\s-]?found/ },
  {
    code: 'soroban_host_error',
    pattern: /host\s?error|error:\s*host|exceeded\s+budget|ran out of budget/,
  },
  { code: 'insufficient_fee', pattern: /insufficient\s*fee|resource fee/ },
  {
    code: 'contract_error',
    // `Error(Contract, #1234)` is how the SDK surfaces contracterror!.
    pattern: /error\(contract,\s*#\d+\)|contracterror/,
  },
];

/** Resolves a raw error string to a coded rule. */
export function classifyTxError(rawError: string | null | undefined): TxErrorCode {
  const text = (rawError ?? '').toLowerCase();
  if (!text.trim()) return 'unknown';

  for (const { code, pattern } of MATCHERS) {
    if (pattern.test(text)) return code;
  }
  return 'unknown';
}

/** Builds the full explanation panel model for a raw error string. */
export function explainTxError(rawError: string | null | undefined): TxErrorExplanation {
  const code = classifyTxError(rawError);
  const rule = RULES[code];
  return { code, ...rule };
}
