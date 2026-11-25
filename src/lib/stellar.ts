/**
 * Utilities for Stellar network integration, transaction hash validation,
 * and block explorer links.
 */

/**
 * Validates whether a given input is a valid 64-character hexadecimal Stellar transaction hash.
 * Closes #477: Payments: Add Stellar transaction hash validation helper
 *
 * @param hash The transaction hash string to validate
 * @returns true if the hash is exactly 64 hexadecimal characters, false otherwise
 */
export function isValidStellarTxHash(hash: string | null | undefined): boolean {
  if (!hash || typeof hash !== "string") {
    return false;
  }
  return /^[a-fA-F0-9]{64}$/.test(hash.trim());
}

/**
 * Generates a Stellar Expert block explorer URL for a given transaction hash.
 * Closes #478: Payments: Add Stellar Expert transaction status inspector link
 *
 * @param hash The 64-character hexadecimal transaction hash
 * @param network Stellar network: 'testnet' (default) or 'public' / 'mainnet'
 * @returns The explorer URL string
 */
export function getStellarExpertTxUrl(
  hash: string,
  network: "testnet" | "public" | "mainnet" = "testnet",
): string {
  const net = network === "mainnet" || network === "public" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${net}/tx/${hash.trim()}`;
}
