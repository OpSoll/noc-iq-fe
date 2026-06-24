/**
 * Maps frontend version ranges to the backend API versions they support.
 * Key: frontend major.minor prefix (e.g. "0.1") — value: array of compatible apiVersions.
 */
export const COMPATIBILITY_MATRIX: Record<string, string[]> = {
  "0.1": ["v1", "v1.1"],
  "0.2": ["v1.1", "v2"],
  "1.0": ["v2", "v2.1"],
};

export interface CompatibilityResult {
  compatible: boolean;
  details: string;
}

/**
 * Checks whether a given frontend version is compatible with a backend API version.
 * @param feVersion  Full semver string, e.g. "0.1.0"
 * @param beVersion  API version string, e.g. "v1"
 */
export function checkCompatibility(
  feVersion: string,
  beVersion: string
): CompatibilityResult {
  const prefix = feVersion.split(".").slice(0, 2).join(".");
  const supported = COMPATIBILITY_MATRIX[prefix];

  if (!supported) {
    return {
      compatible: false,
      details: `Frontend version "${feVersion}" (prefix "${prefix}") has no entry in the compatibility matrix.`,
    };
  }

  if (!supported.includes(beVersion)) {
    return {
      compatible: false,
      details: `Frontend ${feVersion} supports backend API versions [${supported.join(", ")}], but got "${beVersion}".`,
    };
  }

  return {
    compatible: true,
    details: `Frontend ${feVersion} is compatible with backend API ${beVersion}.`,
  };
}
