export type WebhookSignatureMetadata = {
  algorithm: string;
  keyId: string;
  signedHeaders: string[];
  signature: string;
  timestamp: string;
  raw: Record<string, string>;
};

export function parseSignatureHeader(header: string): WebhookSignatureMetadata | null {
  const parts = header.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (key) acc[key.trim()] = rest.join("=").replace(/^"|"$/g, "");
    return acc;
  }, {});

  if (!parts.algorithm || !parts.signature) return null;

  return {
    algorithm: parts.algorithm,
    keyId: parts.keyId || "unknown",
    signedHeaders: (parts.signedHeaders || "").split(" ").filter(Boolean),
    signature: parts.signature,
    timestamp: parts.timestamp || "",
    raw: parts,
  };
}

export function formatSignatureInspector(metadata: WebhookSignatureMetadata): { label: string; value: string; valid: boolean }[] {
  return [
    { label: "Algorithm", value: metadata.algorithm, valid: ["v1", "v2", "ed25519"].includes(metadata.algorithm) },
    { label: "Key ID", value: metadata.keyId, valid: metadata.keyId.length > 0 },
    { label: "Timestamp", value: metadata.timestamp, valid: !isNaN(Date.parse(metadata.timestamp)) || !metadata.timestamp },
    { label: "Signed Headers", value: metadata.signedHeaders.join(", "), valid: metadata.signedHeaders.length > 0 },
    { label: "Signature", value: `${metadata.signature.slice(0, 16)}...`, valid: metadata.signature.length >= 32 },
  ];
}

export function verifySignatureAge(metadata: WebhookSignatureMetadata, maxAgeMs: number = 300_000): boolean {
  if (!metadata.timestamp) return false;
  const age = Date.now() - new Date(metadata.timestamp).getTime();
  return age >= 0 && age <= maxAgeMs;
}
