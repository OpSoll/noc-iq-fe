/**
 * Soroban contract validation and asset-metadata helpers.
 *
 * Contract IDs are base32 (RFC 4648, lowercase, no padding) over 32 bytes.
 * Validating the shape locally means the modal can reject a typo without a
 * round trip, while still treating "well-formed but not a token" as a runtime
 * RPC concern.
 *
 * Closes #659 — custom SAC/token contract address tracker.
 */

const CONTRACT_ID_RE = /^[a-z2-7]{56}$/;

export const CONTRACT_ID_ERROR =
  'Contract ID must be 56 characters of lowercase base32 (a-z, 2-7)';

export function isValidContractId(value: string): boolean {
  return CONTRACT_ID_RE.test(value.trim());
}

export function validateContractId(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Contract ID is required';
  return isValidContractId(trimmed) ? null : CONTRACT_ID_ERROR;
}

export interface ContractAssetMetadata {
  symbol: string;
  decimals: number;
  issuer?: string;
}

/**
 * Parses a `symbol` / `decimals` map returned by a `getAssetInfo` style RPC
 * call. Soroban returns a Val of shape `{ symbol, decimals }`; this tolerates
 * the common variations (string numbers, missing decimals) and falls back to
 * safe defaults rather than throwing.
 */
export function parseAssetMetadata(raw: unknown): ContractAssetMetadata {
  const source = (raw ?? {}) as Record<string, unknown>;
  const symbol = typeof source.symbol === 'string' ? source.symbol : 'UNKNOWN';
  const decimalsRaw = source.decimals;
  const decimals =
    typeof decimalsRaw === 'number' && Number.isFinite(decimalsRaw)
      ? Math.max(0, Math.trunc(decimalsRaw))
      : typeof decimalsRaw === 'string' && /^\d+$/.test(decimalsRaw)
        ? Number(decimalsRaw)
        : 7;
  const issuer = typeof source.issuer === 'string' ? source.issuer : undefined;
  return { symbol, decimals, issuer };
}

/**
 * Formats a raw integer contract balance using the token's decimals.
 * Returns `null` for non-numeric input instead of rendering `NaN`.
 */
export function formatContractBalance(
  raw: string | number | null | undefined,
  decimals: number
): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  const text = String(raw).trim();
  if (!/^\d+$/.test(text)) return null;

  const padded = text.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals) || '0';
  const fraction = decimals === 0 ? '' : padded.slice(padded.length - decimals);
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}
