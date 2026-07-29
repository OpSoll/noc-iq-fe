const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet") as "mainnet" | "testnet";

const BASE: Record<typeof NETWORK, string> = {
  mainnet: "https://stellar.expert/explorer/public",
  testnet: "https://stellar.expert/explorer/testnet",
};

export type ExplorerEntityType = "account" | "tx" | "asset" | "operation";

const HEX64_RE = /^[0-9a-fA-F]{64}$/;
const STELLAR_ACCOUNT_RE = /^G[A-Z2-7]{55}$/;

/**
 * Build a safe explorer link for a given entity type and value.
 * Returns null when the value is missing or clearly malformed so
 * callers can degrade gracefully instead of rendering broken links.
 */
export function explorerLink(
  type: ExplorerEntityType,
  value: string | null | undefined,
): string | null {
  if (!value || value.trim() === "") return null;

  // Validate shape before building a link
  if (type === "tx" && !HEX64_RE.test(value.trim())) return null;
  if (type === "account" && !STELLAR_ACCOUNT_RE.test(value.trim())) return null;

  const base = BASE[NETWORK] ?? BASE.testnet;
  return `${base}/${type}/${value.trim()}`;
}

export const STELLAR_NETWORK = NETWORK;

export const STELLAR_NETWORK_LABEL =
  NETWORK === "mainnet" ? "Mainnet" : "Testnet";
